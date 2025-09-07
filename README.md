# 🚀 Expo Pipeline - Exhibition Company Enrichment App

## Overview
Automated web application for enriching exhibition company lists with business intelligence data.

**Live Demo**: [Deploy this app instantly!](#deployment)

## Features
- 📤 **Drag & Drop CSV Upload** - Simple web interface
- 🔗 **LinkedIn URL Discovery** - Find company LinkedIn profiles
- 👥 **Employee Analysis** - Flag companies with 11-200 employees  
- 💰 **Funding Detection** - Identify recently funded companies (1 year)
- 📊 **Job Analysis** - Detect sales/marketing/BD hiring activity
- 📈 **Priority Scoring** - Rank prospects with business intelligence
- 📥 **Enhanced Download** - Get enriched CSV with all flags

## How It Works
1. **Upload**: Drop your exhibition CSV file
2. **Process**: Real-time progress through 6 enrichment stages
3. **Download**: Get enhanced CSV with business intelligence flags

## Perfect For
- 🎪 **Exhibition organizers** - Enrich attendee lists
- 💼 **Sales teams** - Prioritize prospects with funding/hiring signals  
- 📊 **Marketing teams** - Target high-value companies
- 🔍 **Business development** - Find warm leads

## Quick Deploy (5 minutes)

### Option 1: Vercel (Recommended)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/expo-pipeline)

1. Click "Deploy with Vercel"
2. Connect your GitHub account
3. Add environment variable: `rapid_api_key=your_key_here`
4. Deploy and get instant public URL!

### Option 2: Railway
1. Go to [railway.app](https://railway.app)
2. Connect this GitHub repo
3. Add environment variable: `rapid_api_key=your_key_here`
4. Deploy automatically

### Option 3: Render
1. Go to [render.com](https://render.com)  
2. Create new web service from this repo
3. Add environment variable: `rapid_api_key=your_key_here`
4. Deploy and share your URL

## Local Development

```bash
# Clone and setup
git clone https://github.com/YOUR_USERNAME/expo-pipeline.git
cd expo-pipeline
npm install

# Create environment file
cp .env.example .env
# Edit .env and add your rapid_api_key

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

## Environment Variables
Only one required:

```
rapid_api_key=your_rapidapi_key_for_linkedin_data_scraper
```

Get your key: [RapidAPI LinkedIn Data Scraper](https://rapidapi.com/linkedin-data-scraper/api/linkedin-data-scraper)

## CSV Input Format
Any CSV with company information works! Common columns:
- `name` or `Company Name` (required)
- `website` (optional - will be found if missing)
- `description` (optional)
- Any other columns (preserved in output)

## Output Enhancements
Your original CSV plus:
- `linkedin_url` - Discovered LinkedIn profile
- `employee_count` - Current employee count  
- `in_target_range_11_200` - TRUE/FALSE for 11-200 employees
- `has_funding_data` - TRUE/FALSE for any funding
- `has_recent_funding_1yr` - TRUE/FALSE for recent funding
- `has_recent_jobs` - TRUE/FALSE for sales/marketing jobs
- `priority_score` - 0-10 priority ranking

## Tech Stack
- **Backend**: Node.js, Express
- **Frontend**: Vanilla JS, HTML5, CSS3
- **APIs**: RapidAPI LinkedIn Data Scraper
- **Deployment**: Vercel/Railway/Render ready

## License
MIT - Use freely for personal and commercial projects

---

**Deploy in 5 minutes and start enriching exhibition data!** 🎯
