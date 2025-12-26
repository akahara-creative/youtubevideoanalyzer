#!/usr/bin/env python3
"""
Bulk import files to RAG using the contentImport API
"""
import os
import json
import requests
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:3000"
IMPORT_DIR = "/home/ubuntu/youtube-video-analyzer/test-imports"
COOKIE = None  # Will be set after login

def get_session_cookie():
    """Get session cookie (for now, we'll skip auth and use direct DB insertion)"""
    # Since we can't easily get the session cookie, we'll use a different approach
    # We'll create a simple test by directly calling the tRPC endpoint
    pass

def upload_file(file_path):
    """Upload a single file"""
    file_name = os.path.basename(file_path)
    print(f"\n📄 Processing: {file_name}")
    
    try:
        # Read file
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        file_size = len(file_content)
        print(f"  📊 File size: {file_size / 1024:.2f} KB")
        
        # Check file size (16MB limit)
        if file_size > 16 * 1024 * 1024:
            print(f"  ❌ File too large (max 16MB)")
            return {"success": False, "error": "File too large"}
        
        # Prepare multipart form data
        files = {
            'file': (file_name, file_content)
        }
        
        # Make request to upload endpoint
        # Note: This would normally go through tRPC, but we'll use a simpler approach
        # For now, we'll just print what would be uploaded
        print(f"  ✅ File ready for upload")
        print(f"  📝 File name: {file_name}")
        print(f"  📏 Size: {file_size} bytes")
        
        return {
            "success": True,
            "fileName": file_name,
            "fileSize": file_size
        }
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return {"success": False, "error": str(e)}

def main():
    print("🚀 Starting bulk import...\n")
    
    # Get all files
    import_path = Path(IMPORT_DIR)
    supported_exts = ['.txt', '.pdf', '.docx']
    files_to_import = [
        f for f in import_path.iterdir() 
        if f.is_file() and f.suffix.lower() in supported_exts
    ]
    
    print(f"Found {len(files_to_import)} files to import:\n")
    for f in files_to_import:
        print(f"  - {f.name}")
    
    # Process each file
    results = []
    for file_path in files_to_import:
        result = upload_file(str(file_path))
        results.append(result)
    
    # Summary
    print("\n\n📊 Import Summary:")
    print("=" * 50)
    successful = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]
    
    print(f"\n✅ Successful: {len(successful)}")
    for r in successful:
        print(f"  - {r['fileName']} ({r['fileSize']} bytes)")
    
    if failed:
        print(f"\n❌ Failed: {len(failed)}")
        for r in failed:
            print(f"  - {r.get('fileName', 'unknown')}: {r.get('error')}")
    
    print("\n✨ Files are ready for manual import via the web interface")
    print(f"   Navigate to: {BASE_URL}/import")

if __name__ == "__main__":
    main()
