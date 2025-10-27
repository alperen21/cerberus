# Google Cloud Setup for Cerberus Whitelist

## Overview

The Cerberus whitelist feature uses Google's Chrome User Experience Report (CrUX) API to identify trusted domains. This requires Google Cloud credentials.

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click "Select a project" → "New Project"
4. Enter project name (e.g., "cerberus-phishing-detection")
5. Click "Create"

### 2. Enable the BigQuery API

1. In the Cloud Console, go to **APIs & Services** → **Library**
2. Search for "BigQuery API"
3. Click on it and press **Enable**

### 3. Create a Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Enter details:
   - **Name:** cerberus-bigquery
   - **Description:** Service account for Cerberus whitelist queries
4. Click **Create and Continue**
5. Grant role: **BigQuery User** (or BigQuery Data Viewer for read-only)
6. Click **Done**

### 4. Create and Download Credentials

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Click **Create**
6. The JSON file will download automatically

### 5. Save the Credentials File

```bash
# Create a secure directory for credentials
mkdir -p ~/cerberus-credentials

# Move the downloaded file
mv ~/Downloads/cerberus-*.json ~/cerberus-credentials/gcp-credentials.json

# Set secure permissions (read-only for you)
chmod 600 ~/cerberus-credentials/gcp-credentials.json
```

### 6. Set Environment Variable

**For current terminal session:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
```

**To make it permanent:**

**On macOS/Linux (bash):**
```bash
echo 'export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json' >> ~/.bashrc
source ~/.bashrc
```

**On macOS (zsh - default on newer Macs):**
```bash
echo 'export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json' >> ~/.zshrc
source ~/.zshrc
```

### 7. Verify Setup

```bash
# Check if environment variable is set
echo $GOOGLE_APPLICATION_CREDENTIALS

# Should output: /Users/yourusername/cerberus-credentials/gcp-credentials.json

# Test the credentials
cd /Users/seemanteng/Desktop/cerberus/cerberus/backend
python3 -c "from google.cloud import bigquery; client = bigquery.Client(); print('✅ Credentials work!')"
```

## ⚠️ Important Notes

### Free Tier

Google Cloud BigQuery has a generous free tier:
- **1 TB** of query processing per month (free)
- **10 GB** of storage per month (free)

The Cerberus whitelist queries are very small and cached, so you'll likely stay within free tier.

### Billing

You may need to enable billing on your Google Cloud project, but you won't be charged if you stay within the free tier.

### Security

- **Never commit** credentials to git
- Keep the JSON file secure
- The `.gitignore` already excludes credential files

## 🔒 .gitignore Entries

Make sure your `.gitignore` includes:
```
# Google Cloud credentials
*-credentials.json
gcp-credentials.json
*.json
!package*.json
!tsconfig.json
!manifest.json
```

## 📊 Understanding CrUX Data

The whitelist feature queries Google's public CrUX dataset:
- Dataset: `chrome-ux-report.materialized.metrics_summary`
- Contains: Top domains by traffic and performance metrics
- Updates: Monthly
- Cache: Results cached locally for 30 days

## Troubleshooting

### Error: "Could not automatically determine credentials"

**Solution:** Environment variable not set correctly
```bash
# Check current value
echo $GOOGLE_APPLICATION_CREDENTIALS

# Set it again
export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
```

### Error: "Permission denied" or "Access denied"

**Solution:** Service account needs BigQuery permissions
1. Go to IAM & Admin → IAM
2. Find your service account
3. Add role: "BigQuery User" or "BigQuery Data Viewer"

### Error: "Billing not enabled"

**Solution:** Enable billing (but stay in free tier)
1. Go to Billing in Cloud Console
2. Link a payment method (credit card)
3. You won't be charged if you stay under 1TB/month queries

### Error: "API not enabled"

**Solution:** Enable BigQuery API
```bash
gcloud services enable bigquery.googleapis.com
```

Or do it manually in Cloud Console → APIs & Services → Library

## Alternative: Use Service Account Key Directly

If you don't want to use environment variables, you can pass the path directly in code:

Edit `filter/whitelist.py`:
```python
# Instead of relying on environment variable
from google.oauth2 import service_account

credentials = service_account.Credentials.from_service_account_file(
    '/path/to/your/credentials.json'
)

client = bigquery.Client(
    project="your-project-id",
    credentials=credentials
)
```

But using the environment variable is cleaner and more secure.
