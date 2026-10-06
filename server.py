import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from converter import convert_file
import uvicorn

app = FastAPI(title="DocMorph File Conversion API")

# Allow all origins (allows Vercel deployed frontend and localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "DocMorph File Studio Pro Converter API",
        "version": "1.0.0"
    }

@app.post("/api/convert")
async def convert_endpoint(
    target_format: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        content = await file.read()
        out_bytes, out_name, mime_type = convert_file(content, file.filename, target_format)
        
        return Response(
            content=out_bytes,
            media_type=mime_type,
            headers={"Content-Disposition": f'attachment; filename="{out_name}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
