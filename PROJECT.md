# Expo Pipeline Project Documentation

## Project Goal
Build a reusable, automated pipeline for processing exhibition company lists with standardized enrichment and analysis stages, accessible via a simple web UI for local use.

## Core Requirements

### Input
- CSV file with columns: `name`, `description`, `website`, `linkedin_url` (optional), plus any other columns
- All original columns must be preserved in output

### Processing Stages (Sequential)

#### Stage 1: LinkedIn Enhancement
- **IF** `linkedin_url` is empty/missing:
  - Try to find LinkedIn URL via company website
  - Fallback to web search if website method fails
- **OUTPUT**: Add `linkedin_url` column if not present, `linkedin_source` (website/web_search/existing)

#### Stage 2: Employee Analysis (FLAG ONLY - NO FILTERING)
- Use RapidAPI to get employee count via LinkedIn URL
- **DO NOT FILTER** - keep all companies
- **OUTPUT**: Add columns:
  - `employee_count` - Actual number
  - `employee_range` - Range from API (e.g., "51-200")
  - `in_target_range_11_200` - TRUE/FALSE flag
  - `employee_data_source` - Evidence/source

#### Stage 3: Funding Analysis
- Use RapidAPI company_pro endpoint
- Check for funding data, especially recent (within 1 year)
- **OUTPUT**: Add columns:
  - `has_funding_data` - TRUE/FALSE
  - `has_recent_funding_1yr` - TRUE/FALSE 
  - `funding_details` - Summary of funding info
  - `last_funding_date` - Date if available

#### Stage 4: Job Analysis
- Use RapidAPI company_jobs endpoint
- Check for recent job postings (within 3 weeks)
- Focus on sales, marketing, business development roles
- **OUTPUT**: Add columns:
  - `has_recent_jobs` - TRUE/FALSE
  - `has_sales_jobs` - TRUE/FALSE
  - `has_marketing_jobs` - TRUE/FALSE
  - `has_bd_jobs` - TRUE/FALSE
  - `recent_job_titles` - List of relevant job titles
  - `job_posting_dates` - Most recent posting dates

#### Stage 5: Consolidation
- Combine all data into single CSV
- Add priority scoring based on flags
- **OUTPUT**: Final CSV with:
  - All original columns preserved
  - All enrichment columns from stages 1-4
  - `priority_score` - Calculated 0-10 based on flags
  - `processing_date` - When processed
  - `processing_notes` - Any issues/notes

## Technical Architecture

### Backend (Node.js)
```
expo-pipeline/
├── server.js                 # Express server
├── modules/
│   ├── linkedin-enhancer.js # LinkedIn URL discovery
│   ├── employee-analyzer.js # Employee count analysis (FLAG ONLY)
│   ├── funding-analyzer.js  # Funding analysis
│   ├── job-analyzer.js      # Job posting analysis
│   └── consolidator.js      # Final CSV generation
├── public/                   # Web UI files
│   ├── index.html           # Simple upload interface
│   ├── style.css            # Basic styling
│   └── app.js              # Frontend JavaScript
├── uploads/                  # Temporary uploaded files
├── results/                  # Generated CSV outputs
└── package.json             # Dependencies
```

### Web UI (Simple Local Interface)
- **Upload Page**: Drag & drop CSV file
- **Processing Page**: Real-time progress for each stage
- **Download Page**: Download final enriched CSV
- **No database** - all file-based
- **No user accounts** - local use only
- **No email notifications** - just UI updates

## Key Design Decisions

1. **NO FILTERING** - All companies remain in dataset, only FLAGS are added
2. **LOCAL ONLY** - Runs on localhost:3000, no cloud deployment
3. **FILE-BASED** - No database, just CSV files for input/output
4. **PRESERVE DATA** - Original columns untouched, only add new columns
5. **SIMPLE UI** - Basic upload → process → download flow
6. **MODULAR** - Each stage can be run independently if needed

## API Configuration
- Uses RapidAPI LinkedIn Data Scraper
- Rate limiting: 3 seconds between requests
- Batch size: 10 companies at a time
- Retry failed requests: 2 attempts max

## Success Metrics
- All companies processed (no filtering)
- LinkedIn URL discovery rate > 80%
- API success rate > 90%
- Processing time < 1 minute per 10 companies
- Zero data loss (all original data preserved)

## Output CSV Structure
```
Original Columns | LinkedIn Enhancement | Employee Analysis | Funding Analysis | Job Analysis | Scoring
name            | linkedin_url         | employee_count    | has_funding_data | has_recent_jobs | priority_score
description     | linkedin_source      | employee_range    | has_recent_funding_1yr | has_sales_jobs | processing_date
website         |                      | in_target_range_11_200 | funding_details | has_marketing_jobs | processing_notes
...             |                      | employee_data_source | last_funding_date | has_bd_jobs |
                |                      |                   |                  | recent_job_titles |
                |                      |                   |                  | job_posting_dates |
```

## Usage Flow
1. User opens http://localhost:3000
2. Uploads CSV file via drag & drop
3. Sees real-time progress for each stage
4. Downloads enriched CSV when complete
5. Original file and results saved in local folders

## Development Phases
- [x] Phase 1: Project documentation
- [ ] Phase 2: Backend modules (linkedin, employee, funding, jobs)
- [ ] Phase 3: Simple web UI
- [ ] Phase 4: Integration testing
- [ ] Phase 5: Documentation & cleanup

## Notes
- No cloud services required
- No email/Slack notifications
- No user authentication needed
- All processing is synchronous (one file at a time)
- Results are kept locally in results/ folder