"""
Push FeedbackHub Admin Portal to GitHub.
Usage:
    python push_to_github.py <GITHUB_TOKEN_OR_URL> [OPTIONAL_REPO_URL]
or simply run:
    python push_to_github.py
"""

import sys
import os
import subprocess
import getpass

GIT_BIN = r"C:\Users\hp\.gemini\antigravity\scratch\mingit\cmd\git.exe"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REPO_URL = "https://github.com/yhiremath34-tech/yuva.git"

def run_git(args, cwd=PROJECT_DIR):
    cmd = [GIT_BIN] + args
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return result

def main():
    print("=" * 65)
    print(" Push FeedbackHub Portal to GitHub")
    print("=" * 65)

    repo_url = input(f"GitHub Repository URL [{DEFAULT_REPO_URL}]: ").strip()
    if not repo_url:
        repo_url = DEFAULT_REPO_URL

    # Check if token passed or prompt
    token = None
    if len(sys.argv) > 1 and sys.argv[1].startswith("ghp_"):
        token = sys.argv[1].strip()
    else:
        print("\nIf your repository requires authentication, enter your")
        print("GitHub Personal Access Token (PAT) with 'repo' scope.")
        print("(Generate token at: https://github.com/settings/tokens)")
        print("Press Enter to use existing Windows Git credentials.")
        token = getpass.getpass("Enter GitHub Token (optional): ").strip()

    if token:
        # Inject token into URL for authenticated push
        # format: https://<token>@github.com/user/repo.git
        clean_url = repo_url.replace("https://", "").replace("http://", "")
        auth_url = f"https://{token}@{clean_url}"
    else:
        auth_url = repo_url

    print(f"\nTarget Repository: {repo_url}")
    print("Configuring remote 'origin'...")
    
    # Set remote
    run_git(["remote", "remove", "origin"])
    run_git(["remote", "add", "origin", auth_url])
    run_git(["branch", "-M", "main"])

    print("Pushing to GitHub (main branch)...")
    res = run_git(["push", "-u", "origin", "main", "--force"])

    if res.returncode == 0:
        print("\n" + "=" * 65)
        print(" 🎉 SUCCESSFULLY PUSHED TO GITHUB!")
        print("=" * 65)
        print(f" 🌐 Repository Link: {repo_url}")
        print("=" * 65)
    else:
        print("\n❌ Push output / error:")
        print(res.stderr or res.stdout)
        print("\nTip:")
        print("1. If using a Personal Access Token, ensure it has the 'repo' scope.")
        print("2. Verify that the repository exists on GitHub.")
        print("3. Generate a token at: https://github.com/settings/tokens")

if __name__ == "__main__":
    main()
