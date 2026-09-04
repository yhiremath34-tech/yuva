"""
Deploy FeedbackHub Admin Portal to Vercel via REST API
Usage:
    python deploy_vercel.py <YOUR_VERCEL_TOKEN>
or run interactively:
    python deploy_vercel.py
"""

import sys
import os
import json
import urllib.request
import urllib.error
import getpass

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(PROJECT_DIR, "public")
VERCEL_DEPLOY_URL = "https://api.vercel.com/v13/deployments"

def collect_project_files():
    files_payload = []
    
    # Root configs
    for root_file in ["vercel.json"]:
        fpath = os.path.join(PROJECT_DIR, root_file)
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                files_payload.append({
                    "file": root_file,
                    "data": f.read()
                })

    # Public folder files
    for root, _, files in os.walk(PUBLIC_DIR):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, PROJECT_DIR).replace("\\", "/")
            with open(full_path, "r", encoding="utf-8", errors="ignore") as file_handle:
                files_payload.append({
                    "file": rel_path,
                    "data": file_handle.read()
                })

    return files_payload

def deploy_to_vercel(token, project_name="feedbackhub-admin-portal"):
    files = collect_project_files()
    payload = {
        "name": project_name,
        "files": files,
        "projectSettings": {
            "framework": None,
            "outputDirectory": "public"
        },
        "target": "production"
    }

    req = urllib.request.Request(
        VERCEL_DEPLOY_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        print(f"Deploying {len(files)} files to Vercel production...")
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            live_url = res_data.get("url")
            print("\n" + "=" * 65)
            print(" [SUCCESS] Deployment to Vercel Completed!")
            print("=" * 65)
            print(f" -> Production URL: https://{live_url}")
            print(f" -> Admin Portal:   https://{live_url}/index.html")
            print(f" -> Demo Client:    https://{live_url}/demo-client.html")
            print(f" -> Widget Script:  https://{live_url}/widget.js")
            print("=" * 65)
            return f"https://{live_url}"
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"\n[Error] Deployment failed ({e.code}): {err_msg}")
        return None
    except Exception as e:
        print(f"\n[Error] Unexpected error: {e}")
        return None

def main():
    if len(sys.argv) > 1:
        token = sys.argv[1].strip()
    else:
        print("=" * 65)
        print(" Deploy FeedbackHub Portal to Vercel")
        print("=" * 65)
        print("\nTo deploy directly, get your Vercel Access Token at:")
        print("https://vercel.com/account/tokens\n")
        token = getpass.getpass("Paste your Vercel Access Token: ").strip()

    if not token:
        print("Error: No Vercel token provided.")
        sys.exit(1)

    deploy_to_vercel(token)

if __name__ == "__main__":
    main()
