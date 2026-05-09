import uvicorn
import os

if __name__ == "__main__":
    # Ensure outputs directory exists
    os.makedirs("outputs", exist_ok=True)
    
    print("Starting NoteCraft Backend...")
    print("Ignoring 'outputs' directory for reloader to prevent infinite loops.")
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_excludes=["outputs/*", "**/__pycache__/*", "*.pyc"]
    )
