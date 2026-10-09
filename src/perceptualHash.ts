/**
 * Perceptual Hash (dHash) & Local Forensic Memory (Phase 5)
 * 
 * Rules:
 * - Computes 64-bit difference hash (dHash) from 9x8 downsampled grayscale canvas
 * - Stores flagged scans in IndexedDB for local matching
 * - If new image matches a previously flagged AI image (Hamming distance <= 6), raises suspicion
 * - Never lowers score; absence of previous match has 0 effect on score
 * - Gracefully falls back in Node.js (eval harness) without throwing
 */

const DB_NAME = 'docmorph_forensics_memory'
const DB_VERSION = 1
const STORE_NAME = 'flagged_hashes'

export interface HashRecord {
  hash: string
  verdict: string
  isAi: boolean
  timestamp: number
}

export interface HashMatchResult {
  matched: boolean
  distance: number
  matchedHash?: string
  prevVerdict?: string
}

/**
 * Computes 64-bit difference hash (dHash) for an image.
 */
export function computeDHash(img: any): string {
  try {
    if (typeof document === 'undefined') return ''

    const canvas = document.createElement('canvas')
    canvas.width = 9
    canvas.height = 8
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.drawImage(img, 0, 0, 9, 8)
    const imgData = ctx.getImageData(0, 0, 9, 8).data

    // Convert to 9x8 grayscale
    const gray = new Uint8Array(9 * 8)
    for (let i = 0, j = 0; i < imgData.length; i += 4, j++) {
      gray[j] = Math.round(0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2])
    }

    // Compute difference hash: compare adjacent pixels in each row
    let bits = ''
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = gray[y * 9 + x]
        const right = gray[y * 9 + x + 1]
        bits += left > right ? '1' : '0'
      }
    }

    // Convert 64 bits to 16 hex characters
    let hex = ''
    for (let i = 0; i < 64; i += 4) {
      const nibble = bits.substring(i, i + 4)
      hex += parseInt(nibble, 2).toString(16)
    }
    return hex
  } catch {
    return ''
  }
}

/**
 * Calculates Hamming distance (number of bit differences) between two hex hashes.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64

  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16)
    const n2 = parseInt(hash2[i], 16)
    let xor = n1 ^ n2
    while (xor > 0) {
      distance += xor & 1
      xor >>= 1
    }
  }
  return distance
}

// In-memory cache for fast lookups & Node.js test environments
const memoryCache: HashRecord[] = []

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null)
    }

    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'hash' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Checks if current hash closely matches any previously flagged AI image.
 */
export async function checkKnownAiHash(
  hash: string,
  maxDistance = 6
): Promise<HashMatchResult> {
  if (!hash) return { matched: false, distance: 64 }

  // Check in-memory records
  for (const rec of memoryCache) {
    if (rec.isAi) {
      const dist = hammingDistance(hash, rec.hash)
      if (dist <= maxDistance) {
        return {
          matched: true,
          distance: dist,
          matchedHash: rec.hash,
          prevVerdict: rec.verdict,
        }
      }
    }
  }

  // Check IndexedDB
  const db = await openDb()
  if (!db) return { matched: false, distance: 64 }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.getAll()

      req.onsuccess = () => {
        const records: HashRecord[] = req.result || []
        for (const rec of records) {
          if (rec.isAi) {
            const dist = hammingDistance(hash, rec.hash)
            if (dist <= maxDistance) {
              return resolve({
                matched: true,
                distance: dist,
                matchedHash: rec.hash,
                prevVerdict: rec.verdict,
              })
            }
          }
        }
        resolve({ matched: false, distance: 64 })
      }
      req.onerror = () => resolve({ matched: false, distance: 64 })
    } catch {
      resolve({ matched: false, distance: 64 })
    }
  })
}

/**
 * Persists a scanned image hash locally in IndexedDB & memory.
 */
export async function saveScannedHash(
  hash: string,
  verdict: string,
  isAi: boolean
): Promise<void> {
  if (!hash) return

  const record: HashRecord = {
    hash,
    verdict,
    isAi,
    timestamp: Date.now(),
  }

  // Update in-memory
  memoryCache.push(record)

  // Update IndexedDB
  const db = await openDb()
  if (!db) return

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(record)
  } catch {
    // Ignore storage errors
  }
}
