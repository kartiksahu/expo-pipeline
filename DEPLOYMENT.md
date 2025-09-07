# Expo Pipeline - Deployment Guide

## Quick Deploy Options

### Option 1: Vercel (Recommended)
1. Fork this repo to your GitHub
2. Go to [vercel.com](https://vercel.com)
3. Connect GitHub and import this project
4. Add environment variables (if needed)
5. Deploy! Get instant public URL

### Option 2: Railway
1. Go to [railway.app](https://railway.app)
2. Connect GitHub and deploy this repo
3. Set environment variables
4. Get public URL

### Option 3: Render
1. Go to [render.com](https://render.com)
2. Connect GitHub and create new web service
3. Use this repository
4. Deploy and get public URL

## Environment Variables
Set these in your deployment platform:

```
NODE_ENV=production
rapid_api_key=your_rapidapi_key_here
```

## Public Usage
Once deployed, anyone can:
1. Visit your public URL
2. Upload their exhibition CSV file
3. Process it through the enrichment pipeline
4. Download the enhanced results

## Features
- ✅ LinkedIn URL discovery
- ✅ Employee count analysis (11-200 filter flags)
- ✅ Recent funding detection (1 year)
- ✅ Sales/Marketing job posting analysis
- ✅ Priority scoring and flags
- ✅ No data loss - preserves all original columns

Perfect for processing exhibition attendee lists with business intelligence!
