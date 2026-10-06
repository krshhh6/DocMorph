import os
import io
import subprocess
import tempfile
import zipfile
from PIL import Image
import fitz  # PyMuPDF
from pdf2docx import Converter as PDF2DocxConverter

def convert_docx_to_pdf(input_bytes: bytes) -> bytes:
    """Converts DOCX to PDF using LibreOffice headless (Linux/Docker) or docx2pdf (Windows)."""
    with tempfile.TemporaryDirectory() as temp_dir:
        in_docx = os.path.join(temp_dir, "input.docx")
        with open(in_docx, "wb") as f:
            f.write(input_bytes)
            
        # Try LibreOffice (standard on Linux / Railway Docker)
        try:
            cmd = ["soffice", "--headless", "--convert-to", "pdf", "--outdir", temp_dir, in_docx]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            out_pdf = os.path.join(temp_dir, "input.pdf")
            if os.path.exists(out_pdf):
                with open(out_pdf, "rb") as f:
                    return f.read()
        except Exception:
            pass

        # Fallback for Windows local test with docx2pdf if available
        try:
            from docx2pdf import convert as docx_to_pdf_win
            out_pdf = os.path.join(temp_dir, "input.pdf")
            docx_to_pdf_win(in_docx, out_pdf)
            if os.path.exists(out_pdf):
                with open(out_pdf, "rb") as f:
                    return f.read()
        except Exception as e:
            raise RuntimeError(f"DOCX to PDF conversion failed: {e}")

        raise RuntimeError("No suitable DOCX to PDF converter found (LibreOffice required in Linux).")

def convert_file(input_bytes: bytes, filename: str, target_fmt: str) -> tuple[bytes, str, str]:
    """
    Converts input_bytes into target_fmt.
    Returns: (output_bytes, output_filename, mime_type)
    """
    target_fmt = target_fmt.upper()
    base_name, src_ext = os.path.splitext(filename)
    src_ext = src_ext.lower().replace('.', '')
    
    # 1. IMAGE TO IMAGE (PNG, JPG, JPEG, WEBP)
    if src_ext in ['png', 'jpg', 'jpeg', 'webp'] and target_fmt in ['PNG', 'JPG', 'JPEG', 'WEBP']:
        img = Image.open(io.BytesIO(input_bytes))
        out_buf = io.BytesIO()
        
        if target_fmt in ['JPG', 'JPEG'] and img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
            
        pil_format = 'JPEG' if target_fmt in ['JPG', 'JPEG'] else target_fmt
        img.save(out_buf, format=pil_format, quality=95)
        out_ext = 'jpg' if target_fmt in ['JPG', 'JPEG'] else target_fmt.lower()
        return out_buf.getvalue(), f"{base_name}.{out_ext}", f"image/{out_ext}"

    # 2. IMAGE TO PDF
    if src_ext in ['png', 'jpg', 'jpeg', 'webp'] and target_fmt == 'PDF':
        img = Image.open(io.BytesIO(input_bytes))
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        out_buf = io.BytesIO()
        img.save(out_buf, format='PDF', resolution=100.0)
        return out_buf.getvalue(), f"{base_name}.pdf", "application/pdf"

    # 3. PDF TO IMAGES (PNG, JPG, WEBP)
    if src_ext == 'pdf' and target_fmt in ['PNG', 'JPG', 'WEBP']:
        doc = fitz.open(stream=input_bytes, filetype="pdf")
        if len(doc) == 1:
            page = doc[0]
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes(target_fmt.lower())
            return img_bytes, f"{base_name}.{target_fmt.lower()}", f"image/{target_fmt.lower()}"
        else:
            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                for idx, page in enumerate(doc):
                    pix = page.get_pixmap(dpi=150)
                    zf.writestr(f"{base_name}_page_{idx+1}.{target_fmt.lower()}", pix.tobytes(target_fmt.lower()))
            return zip_buf.getvalue(), f"{base_name}_pages.zip", "application/zip"

    # 4. PDF TO DOCX
    if src_ext == 'pdf' and target_fmt == 'DOCX':
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_pdf = os.path.join(temp_dir, "in.pdf")
            temp_docx = os.path.join(temp_dir, "out.docx")
            with open(temp_pdf, "wb") as f:
                f.write(input_bytes)
            cv = PDF2DocxConverter(temp_pdf)
            cv.convert(temp_docx)
            cv.close()
            with open(temp_docx, "rb") as f:
                data = f.read()
            return data, f"{base_name}.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    # 5. DOCX TO PDF
    if src_ext in ['docx', 'doc'] and target_fmt == 'PDF':
        pdf_bytes = convert_docx_to_pdf(input_bytes)
        return pdf_bytes, f"{base_name}.pdf", "application/pdf"

    raise ValueError(f"Conversion from .{src_ext} to {target_fmt} is not supported.")
