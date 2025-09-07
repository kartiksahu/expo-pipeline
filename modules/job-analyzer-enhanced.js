/**
 * Enhanced Job Analysis Module
 * Combines original LinkedIn API with Phase 1 fallback mechanisms
 * Uses scraping fallbacks when API data is insufficient
 */

const axios = require('axios');
const JobScraperFallback = require('./job-scraper-fallback');

class JobAnalyzerEnhanced {
    constructor(stageConfig, apiSettings) {
        this.config = stageConfig;
        this.api = apiSettings;
        this.fallbackScraper = new JobScraperFallback({
            timeout: 10000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        this.results = {
            processed: 0,
            successful: 0,
            withRecentJobs: 0,
            withSalesJobs: 0,
            withMarketingJobs: 0,
            withBDJobs: 0,
            fallbackUsed: 0,
            fallbackSuccessful: 0,
            errors: []
        };
    }

    async process(companies) {
        console.log(`   📊 Enhanced Job Analysis for ${companies.length} companies...`);
        console.log(`   🎯 Recent job threshold: ${this.config.recent_threshold_weeks} weeks`);
        console.log(`   💼 Target roles: ${this.config.target_roles.join(', ')}`);
        console.log(`   🔄 Fallback scraping enabled for insufficient data`);
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`   [${i + 1}/${companies.length}] ${company.name || company.companyName}`);
            
            try {
                // Step 1: Try primary LinkedIn API method
                let jobData = await this.getJobDataWithRetry(company);
                let usedFallback = false;
                
                // Step 2: Check if primary data is sufficient
                const needsFallback = this.shouldUseFallback(jobData, company);
                
                if (needsFallback) {
                    console.log(`     🔄 Primary API insufficient, trying fallback methods...`);
                    this.results.fallbackUsed++;
                    
                    // Step 3: Use fallback scraping methods
                    const fallbackData = await this.fallbackScraper.findJobOpenings(company);
                    
                    if (fallbackData.found) {
                        // Merge fallback data with primary data
                        jobData = this.mergeFallbackData(jobData, fallbackData);
                        this.results.fallbackSuccessful++;
                        usedFallback = true;
                        console.log(`     ✅ Fallback methods found additional data (${fallbackData.sources.join(', ')})`);
                    } else {
                        console.log(`     ❌ Fallback methods found no additional data`);
                    }
                }
                
                // Add job flags to company
                company.has_recent_jobs = jobData.has_recent_jobs;
                company.has_sales_jobs = jobData.has_sales_jobs;
                company.has_marketing_jobs = jobData.has_marketing_jobs;
                company.has_bd_jobs = jobData.has_bd_jobs;
                company.recent_job_titles = jobData.recent_job_titles;
                company.job_posting_dates = jobData.job_posting_dates;
                company.recent_job_count = jobData.recent_job_count;
                company.hiring_urgency = jobData.hiring_urgency;
                company.job_data_sources = jobData.data_sources;
                company.job_confidence = jobData.confidence;
                
                this.results.processed++;
                if (jobData.api_success || usedFallback) {
                    this.results.successful++;
                }
                
                if (jobData.has_recent_jobs) {
                    this.results.withRecentJobs++;
                    console.log(`     📋 Target role jobs found (${jobData.data_sources.join(', ')})`);
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
                
                // Rate limiting
                if (i < companies.length - 1) {
                    await this.delay(usedFallback ? 3000 : 1000); // Longer delay if used scraping
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                
                // Set default values for failed companies
                company.has_recent_jobs = false;
                company.has_sales_jobs = false;
                company.has_marketing_jobs = false;
                company.has_bd_jobs = false;
                company.recent_job_titles = '';
                company.job_posting_dates = '';
                company.recent_job_count = 0;
                company.hiring_urgency = 'None';
                company.job_data_sources = '';
                company.job_confidence = 0;
                
                this.results.errors.push({ company: company.name, error: error.message });
                this.results.processed++;
            }
        }
        
        return this.generateSummary();
    }

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
            
            // Filter for recent jobs
            const recentJobs = allJobs.filter(job => this.isJobRecent(job.listedAt));
            
            // Analyze job roles
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
                confidence: 0.8 // High confidence for API data
            };
            
        } catch (error) {
            // Try fallback parameter format
            if (error.response?.status === 400) {
                options.data.link = options.data.company_url;
                delete options.data.company_url;
                
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
            }
            throw error;
        }
    }

    shouldUseFallback(primaryData, company) {
        // Use fallback if:
        // 1. API failed completely
        // 2. No recent jobs found but company seems active (has website, employees, etc.)
        // 3. Very low job count for a larger company
        
        if (!primaryData.api_success) return true;
        
        if (primaryData.recent_job_count === 0 && company.employee_count > 20) return true;
        
        if (primaryData.recent_job_count < 2 && company.employee_count > 50) return true;
        
        return false;
    }

    mergeFallbackData(primaryData, fallbackData) {
        const merged = { ...primaryData };
        
        // Merge data sources
        merged.data_sources = [...(primaryData.data_sources || []), ...fallbackData.sources];
        
        // Update flags if fallback found target roles
        merged.has_sales_jobs = merged.has_sales_jobs || fallbackData.hasSales;
        merged.has_marketing_jobs = merged.has_marketing_jobs || fallbackData.hasMarketing;
        merged.has_bd_jobs = merged.has_bd_jobs || fallbackData.hasBD;
        
        // Update has_recent_jobs based on new logic
        merged.has_recent_jobs = merged.has_sales_jobs || merged.has_marketing_jobs || merged.has_bd_jobs;
        
        // Merge job titles
        const allTitles = [
            ...(primaryData.recent_job_titles ? primaryData.recent_job_titles.split('; ') : []),
            ...fallbackData.jobTitles
        ];
        merged.recent_job_titles = allTitles.slice(0, 5).join('; ');
        
        // Adjust confidence based on data sources
        merged.confidence = (primaryData.confidence + fallbackData.confidence) / 2;
        
        return merged;
    }

    // ... (include all the existing methods from the original job analyzer)
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
        
        // Enhanced patterns from fallback scraper
        const salesPatterns = this.fallbackScraper.salesPatterns;
        const marketingPatterns = this.fallbackScraper.marketingPatterns;
        const bdPatterns = this.fallbackScraper.bdPatterns;
        
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
        
        const fallbackUsageRate = this.results.processed > 0
            ? ((this.results.fallbackUsed / this.results.processed) * 100).toFixed(1)
            : 0;
        
        const fallbackSuccessRate = this.results.fallbackUsed > 0
            ? ((this.results.fallbackSuccessful / this.results.fallbackUsed) * 100).toFixed(1)
            : 0;
            
        console.log(`\\n   📊 Enhanced Job Analysis Summary:`);
        console.log(`      Processed: ${this.results.processed} companies`);
        console.log(`      Overall Success: ${this.results.successful} (${successRate}%)`);
        console.log(`      Fallback Usage: ${this.results.fallbackUsed} (${fallbackUsageRate}%)`);
        console.log(`      Fallback Success: ${this.results.fallbackSuccessful} (${fallbackSuccessRate}%)`);
        console.log(`      With target role jobs: ${this.results.withRecentJobs}`);
        console.log(`      With sales jobs: ${this.results.withSalesJobs}`);
        console.log(`      With marketing jobs: ${this.results.withMarketingJobs}`);
        console.log(`      With BD jobs: ${this.results.withBDJobs}`);
        
        return {
            results: [],
            summary: {
                processed: this.results.processed,
                successful: this.results.successful,
                successRate: successRate,
                fallbackUsage: this.results.fallbackUsed,
                fallbackSuccessRate: fallbackSuccessRate,
                qualifiedCount: this.results.withRecentJobs,
                errorCount: this.results.errors.length
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = JobAnalyzerEnhanced;