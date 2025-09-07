/**
 * Integrated Job Analysis Module
 * Combines existing LinkedIn API with real fallback mechanisms
 * Professional integration - preserves all existing functionality
 */

const axios = require('axios');
const JobScraperReal = require('./job-scraper-real');
const UniversalWebSearch = require('./web-search-universal');

class JobAnalyzerIntegrated {
    constructor(stageConfig, apiSettings) {
        // Preserve all existing configuration
        this.config = stageConfig;
        this.api = apiSettings;
        
        // Initialize fallback scrapers
        this.realScraper = new JobScraperReal({
            timeout: 10000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        this.webSearch = new UniversalWebSearch({
            timeout: 15000,
            waitTime: 3000
        });
        
        // Preserve existing results structure
        this.results = {
            processed: 0,
            successful: 0,
            withRecentJobs: 0,
            withSalesJobs: 0,
            withMarketingJobs: 0,
            withBDJobs: 0,
            fallbackUsed: 0,
            fallbackSuccessful: 0,
            webSearchUsed: 0,
            webSearchSuccessful: 0,
            errors: []
        };
    }

    /**
     * Main processing method - preserves existing interface
     */
    async process(companies) {
        console.log(`   📊 Enhanced Job Analysis for ${companies.length} companies...`);
        console.log(`   🎯 Recent job threshold: ${this.config.recent_threshold_weeks} weeks`);
        console.log(`   💼 Target roles: ${this.config.target_roles.join(', ')}`);
        console.log(`   🔄 Real fallback mechanisms enabled`);
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`   [${i + 1}/${companies.length}] ${company.name || company.companyName}`);
            
            try {
                // Step 1: Try existing LinkedIn API method (preserve original logic)
                let jobData = null;
                let apiError = false;
                
                try {
                    jobData = await this.getJobDataWithRetry(company);
                } catch (apiErr) {
                    console.log(`     ❌ API failed: ${apiErr.message}`);
                    apiError = true;
                    // Initialize empty job data for fallback
                    jobData = {
                        api_success: false,
                        has_recent_jobs: false,
                        job_count: 0,
                        job_titles: [],
                        has_sales_marketing_bd: false,
                        data_sources: [],
                        confidence: 0
                    };
                }
                
                let usedFallback = false;
                let usedWebSearch = false;
                
                // Step 2: Check if we should use fallbacks (API error OR insufficient data)
                const needsFallback = apiError || this.shouldUseFallback(jobData, company);
                
                if (needsFallback) {
                    const reason = apiError ? "API failed, trying real fallback methods..." : "API data insufficient, trying real fallback methods...";
                    console.log(`     🔄 ${reason}`);
                    this.results.fallbackUsed++;
                    
                    // Try real scraping fallbacks
                    const fallbackData = await this.realScraper.findJobOpenings(company);
                    
                    if (fallbackData.found) {
                        jobData = this.mergeFallbackData(jobData, fallbackData, 'scraping');
                        this.results.fallbackSuccessful++;
                        usedFallback = true;
                        console.log(`     ✅ Real scraping found data: ${fallbackData.sources.join(', ')}`);
                    }
                    
                    // Step 3: Try web search if still insufficient (most conservative)
                    const stillNeedsMore = !jobData.has_recent_jobs && company.employee_count > 50;
                    
                    if (stillNeedsMore) {
                        console.log(`     🌐 Trying web search as last resort...`);
                        this.results.webSearchUsed++;
                        
                        const webData = await this.webSearch.searchJobOpenings(company.name);
                        
                        if (webData.found) {
                            jobData = this.mergeFallbackData(jobData, webData, 'web_search');
                            this.results.webSearchSuccessful++;
                            usedWebSearch = true;
                            console.log(`     ✅ Web search found additional signals`);
                        }
                    }
                }
                
                // Preserve existing company data structure
                company.has_recent_jobs = jobData.has_recent_jobs;
                company.has_sales_jobs = jobData.has_sales_jobs;
                company.has_marketing_jobs = jobData.has_marketing_jobs;
                company.has_bd_jobs = jobData.has_bd_jobs;
                company.recent_job_titles = jobData.recent_job_titles;
                company.job_posting_dates = jobData.job_posting_dates;
                company.recent_job_count = jobData.recent_job_count;
                company.hiring_urgency = jobData.hiring_urgency;
                
                // Add new fields for data source tracking
                company.job_data_sources = jobData.data_sources || [];
                company.job_confidence = jobData.confidence || 0;
                
                // Update results (preserve existing logic)
                this.results.processed++;
                if (jobData.api_success || usedFallback || usedWebSearch) {
                    this.results.successful++;
                }
                
                if (jobData.has_recent_jobs) {
                    this.results.withRecentJobs++;
                    const sourceInfo = usedFallback ? ' (enhanced)' : '';
                    console.log(`     📋 Target role jobs found${sourceInfo}`);
                }
                if (jobData.has_sales_jobs) {
                    this.results.withSalesJobs++;
                    console.log(`     💼 Sales roles detected`);
                }
                if (jobData.has_marketing_jobs) {
                    this.results.withMarketingJobs++;
                    console.log(`     📢 Marketing roles detected`);
                }
                if (jobData.has_bd_jobs) {
                    this.results.withBDJobs++;
                    console.log(`     🤝 Business Development roles detected`);
                }
                
                // Rate limiting (conservative)
                if (i < companies.length - 1) {
                    const delay = usedWebSearch ? 5000 : (usedFallback ? 3000 : 1000);
                    await this.delay(delay);
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                
                // Preserve existing error handling
                company.has_recent_jobs = false;
                company.has_sales_jobs = false;
                company.has_marketing_jobs = false;
                company.has_bd_jobs = false;
                company.recent_job_titles = '';
                company.job_posting_dates = '';
                company.recent_job_count = 0;
                company.hiring_urgency = 'None';
                company.job_data_sources = [];
                company.job_confidence = 0;
                
                this.results.errors.push({ company: company.name, error: error.message });
                this.results.processed++;
            }
        }
        
        return this.generateSummary();
    }

    /**
     * Existing API method - preserved exactly
     */
    async getJobDataWithRetry(company, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            return await this.getJobData(company);
        } catch (error) {
            if (error.response && error.response.status === 429 && retryCount < maxRetries) {
                const backoffDelay = Math.pow(2, retryCount) * 1000;
                console.log(`     ⏳ Rate limited. Retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await this.delay(backoffDelay);
                return this.getJobDataWithRetry(company, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Existing API method - preserved exactly
     */
    async getJobData(company) {
        if (!company.linkedin_url && !company.linkedin) {
            throw new Error('No LinkedIn URL available for job analysis');
        }

        const linkedinUrl = company.linkedin_url || company.linkedin;
        
        const options = {
            method: 'POST',
            url: `https://${this.api.rapidapi_host}/${this.config.api_endpoint}`,
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': this.api.rapidapi_key,
                'X-RapidAPI-Host': this.api.rapidapi_host
            },
            data: {
                company_url: linkedinUrl,
                starts_from: 0,
                count: 50
            }
        };

        try {
            const response = await axios.request(options);
            const allJobs = response.data.response?.data?.jobs || [];
            
            const recentJobs = allJobs.filter(job => this.isJobRecent(job.listedAt));
            const roleAnalysis = this.analyzeJobRoles(recentJobs);
            
            return {
                api_success: true,
                has_recent_jobs: roleAnalysis.hasSales || roleAnalysis.hasMarketing || roleAnalysis.hasBusinessDevelopment,
                has_sales_jobs: roleAnalysis.hasSales,
                has_marketing_jobs: roleAnalysis.hasMarketing,
                has_bd_jobs: roleAnalysis.hasBusinessDevelopment,
                recent_job_titles: roleAnalysis.titles.slice(0, 5).join('; '),
                job_posting_dates: recentJobs.slice(0, 3).map(job => job.listedAt).join(', '),
                recent_job_count: recentJobs.length,
                hiring_urgency: this.calculateHiringUrgency(recentJobs),
                data_sources: ['linkedin_api'],
                confidence: 0.8
            };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Conservative fallback triggering
     */
    shouldUseFallback(primaryData, company) {
        // Only trigger fallbacks in conservative scenarios
        if (!primaryData.api_success) return true;
        
        // Large companies with zero jobs is suspicious
        if (primaryData.recent_job_count === 0 && company.employee_count > 30) return true;
        
        // Very large companies with very few jobs
        if (primaryData.recent_job_count <= 1 && company.employee_count > 100) return true;
        
        return false;
    }

    /**
     * Merge fallback data with primary data
     */
    mergeFallbackData(primaryData, fallbackData, sourceType) {
        const merged = { ...primaryData };
        
        // Update data sources
        const existingSources = primaryData.data_sources || [];
        const newSources = sourceType === 'web_search' ? ['web_search'] : (fallbackData.sources || []);
        merged.data_sources = [...existingSources, ...newSources];
        
        // Update job flags if fallback found target roles
        merged.has_sales_jobs = merged.has_sales_jobs || fallbackData.hasSales;
        merged.has_marketing_jobs = merged.has_marketing_jobs || fallbackData.hasMarketing;
        merged.has_bd_jobs = merged.has_bd_jobs || fallbackData.hasBD;
        
        // Update has_recent_jobs based on enhanced logic
        merged.has_recent_jobs = merged.has_sales_jobs || merged.has_marketing_jobs || merged.has_bd_jobs;
        
        // Merge job titles
        const existingTitles = primaryData.recent_job_titles ? primaryData.recent_job_titles.split('; ') : [];
        const newTitles = fallbackData.jobTitles || [];
        const allTitles = [...existingTitles, ...newTitles];
        merged.recent_job_titles = allTitles.slice(0, 5).join('; ');
        
        // Adjust confidence
        const fallbackConfidence = fallbackData.confidence || 0.3;
        merged.confidence = Math.min(1.0, (primaryData.confidence + fallbackConfidence) / 2);
        
        return merged;
    }

    // Preserve all existing methods exactly
    isJobRecent(postedTime) {
        if (!postedTime) return false;
        
        const timeStr = postedTime.toLowerCase();
        const thresholdDays = this.config.recent_threshold_weeks * 7;
        
        if (timeStr.includes('hour') || timeStr.includes('minute') || timeStr.includes('second')) {
            return true;
        }
        
        if (timeStr.includes('day')) {
            const dayMatch = timeStr.match(/(\\d+)\\s*day/);
            if (dayMatch) {
                const days = parseInt(dayMatch[1]);
                return days <= thresholdDays;
            }
            return true;
        }
        
        if (timeStr.includes('week')) {
            const weekMatch = timeStr.match(/(\\d+)\\s*week/);
            if (weekMatch) {
                const weeks = parseInt(weekMatch[1]);
                return weeks <= this.config.recent_threshold_weeks;
            }
            return true;
        }
        
        if (timeStr.includes('month')) {
            return false;
        }
        
        return false;
    }

    analyzeJobRoles(jobs) {
        const roleAnalysis = {
            hasSales: false,
            hasMarketing: false,
            hasBusinessDevelopment: false,
            titles: []
        };
        
        // Use enhanced patterns from real scraper
        const salesPatterns = this.realScraper.salesPatterns;
        const marketingPatterns = this.realScraper.marketingPatterns;
        const bdPatterns = this.realScraper.bdPatterns;
        
        jobs.forEach(job => {
            const title = (job.title || '').toLowerCase();
            roleAnalysis.titles.push(job.title);
            
            if (salesPatterns.some(pattern => title.includes(pattern))) {
                roleAnalysis.hasSales = true;
            }
            
            if (marketingPatterns.some(pattern => title.includes(pattern))) {
                roleAnalysis.hasMarketing = true;
            }
            
            if (bdPatterns.some(pattern => title.includes(pattern))) {
                roleAnalysis.hasBusinessDevelopment = true;
            }
        });
        
        return roleAnalysis;
    }

    calculateHiringUrgency(recentJobs) {
        if (recentJobs.length === 0) return 'None';
        
        const veryRecentJobs = recentJobs.filter(job => {
            const timeStr = (job.listedAt || '').toLowerCase();
            return timeStr.includes('hour') || 
                   timeStr.includes('minute') || 
                   timeStr.includes('day') ||
                   (timeStr.includes('1 week') || timeStr.includes('this week'));
        });
        
        if (veryRecentJobs.length > 2) return 'High';
        if (veryRecentJobs.length > 0) return 'Moderate';
        if (recentJobs.length > 0) return 'Low';
        
        return 'None';
    }

    generateSummary() {
        const successRate = this.results.processed > 0 
            ? ((this.results.successful / this.results.processed) * 100).toFixed(1)
            : 0;
        
        const enhancementRate = this.results.processed > 0
            ? (((this.results.fallbackUsed + this.results.webSearchUsed) / this.results.processed) * 100).toFixed(1)
            : 0;
            
        console.log(`\\n   📊 Enhanced Job Analysis Summary:`);
        console.log(`      Processed: ${this.results.processed} companies`);
        console.log(`      Success Rate: ${this.results.successful} (${successRate}%)`);
        console.log(`      Enhanced: ${this.results.fallbackUsed + this.results.webSearchUsed} (${enhancementRate}%)`);
        console.log(`      Real Scraping: ${this.results.fallbackSuccessful}/${this.results.fallbackUsed}`);
        console.log(`      Web Search: ${this.results.webSearchSuccessful}/${this.results.webSearchUsed}`);
        console.log(`      With target jobs: ${this.results.withRecentJobs}`);
        console.log(`      Sales: ${this.results.withSalesJobs} | Marketing: ${this.results.withMarketingJobs} | BD: ${this.results.withBDJobs}`);
        
        return {
            results: [],
            summary: {
                processed: this.results.processed,
                successful: this.results.successful,
                successRate: successRate,
                qualifiedCount: this.results.withRecentJobs,
                errorCount: this.results.errors.length,
                enhancementStats: {
                    fallbackUsed: this.results.fallbackUsed,
                    fallbackSuccessful: this.results.fallbackSuccessful,
                    webSearchUsed: this.results.webSearchUsed,
                    webSearchSuccessful: this.results.webSearchSuccessful
                }
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = JobAnalyzerIntegrated;