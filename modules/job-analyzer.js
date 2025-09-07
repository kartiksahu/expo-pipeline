/**
 * Job Analysis Module
 * Analyzes recent job postings (within 3 weeks) and identifies sales/marketing/BD roles
 * Based on proven BigData Paris job analysis methodology
 */

const axios = require('axios');

class JobAnalyzer {
    constructor(stageConfig, apiSettings) {
        this.config = stageConfig;
        this.api = apiSettings;
        this.results = {
            processed: 0,
            successful: 0,
            withRecentJobs: 0,
            withSalesJobs: 0,
            withMarketingJobs: 0,
            withBDJobs: 0,
            errors: []
        };
    }

    async process(companies) {
        console.log(`   📊 Analyzing job postings for ${companies.length} companies...`);
        console.log(`   🎯 Recent job threshold: ${this.config.recent_threshold_weeks} weeks`);
        console.log(`   💼 Target roles: ${this.config.target_roles.join(', ')}`);
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`   [${i + 1}/${companies.length}] ${company.name || company.companyName}`);
            
            try {
                const jobData = await this.getJobDataWithRetry(company);
                
                // Add job flags to company (NOT FILTERING)
                company.has_recent_jobs = jobData.has_recent_jobs;
                company.has_sales_jobs = jobData.has_sales_jobs;
                company.has_marketing_jobs = jobData.has_marketing_jobs;
                company.has_bd_jobs = jobData.has_bd_jobs;
                company.recent_job_titles = jobData.recent_job_titles;
                company.job_posting_dates = jobData.job_posting_dates;
                company.recent_job_count = jobData.recent_job_count;
                company.hiring_urgency = jobData.hiring_urgency;
                
                this.results.processed++;
                if (jobData.api_success) {
                    this.results.successful++;
                }
                if (jobData.has_recent_jobs) {
                    this.results.withRecentJobs++;
                    console.log(`     📋 ${jobData.recent_job_count} recent jobs found with target roles (sales/marketing/BD)`);
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
                
                // Rate limiting (reduced to 1 second)
                if (i < companies.length - 1) {
                    await this.delay(1000);
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                
                // Still keep the company, just mark job fields
                company.has_recent_jobs = false;
                company.has_sales_jobs = false;
                company.has_marketing_jobs = false;
                company.has_bd_jobs = false;
                company.recent_job_titles = '';
                company.job_posting_dates = '';
                company.recent_job_count = 0;
                company.hiring_urgency = 'None';
                
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
            // Check if it's a rate limit error (429) and we have retries left
            if (error.response && error.response.status === 429 && retryCount < maxRetries) {
                const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
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
            
            // Determine hiring urgency
            const hiringUrgency = this.calculateHiringUrgency(recentJobs);
            
            // Get most recent job posting dates
            const jobDates = recentJobs
                .slice(0, 3)
                .map(job => job.listedAt)
                .filter(date => date)
                .join(', ');
            
            return {
                api_success: true,
                has_recent_jobs: roleAnalysis.hasSales || roleAnalysis.hasMarketing || roleAnalysis.hasBusinessDevelopment,
                has_sales_jobs: roleAnalysis.hasSales,
                has_marketing_jobs: roleAnalysis.hasMarketing,
                has_bd_jobs: roleAnalysis.hasBusinessDevelopment,
                recent_job_titles: roleAnalysis.titles.slice(0, 5).join('; '),
                job_posting_dates: jobDates,
                recent_job_count: recentJobs.length,
                hiring_urgency: hiringUrgency,
                total_jobs: allJobs.length
            };
            
        } catch (error) {
            // Try with 'link' parameter if 'company_url' fails
            if (error.response?.status === 400 && options.data.company_url) {
                options.data.link = options.data.company_url;
                delete options.data.company_url;
                
                const response = await axios.request(options);
                const allJobs = response.data.response?.data?.jobs || [];
                
                // Filter for recent jobs
                const recentJobs = allJobs.filter(job => this.isJobRecent(job.listedAt));
                
                // Analyze job roles
                const roleAnalysis = this.analyzeJobRoles(recentJobs);
                
                // Determine hiring urgency
                const hiringUrgency = this.calculateHiringUrgency(recentJobs);
                
                // Get most recent job posting dates
                const jobDates = recentJobs
                    .slice(0, 3)
                    .map(job => job.listedAt)
                    .filter(date => date)
                    .join(', ');
                
                return {
                    api_success: true,
                    has_recent_jobs: roleAnalysis.hasSales || roleAnalysis.hasMarketing || roleAnalysis.hasBusinessDevelopment,
                    has_sales_jobs: roleAnalysis.hasSales,
                    has_marketing_jobs: roleAnalysis.hasMarketing,
                    has_bd_jobs: roleAnalysis.hasBusinessDevelopment,
                    recent_job_titles: roleAnalysis.titles.slice(0, 5).join('; '),
                    job_posting_dates: jobDates,
                    recent_job_count: recentJobs.length,
                    hiring_urgency: hiringUrgency,
                    total_jobs: allJobs.length
                };
            }
            throw error;
        }
    }

    isJobRecent(postedTime) {
        if (!postedTime) return false;
        
        const timeStr = postedTime.toLowerCase();
        const thresholdDays = this.config.recent_threshold_weeks * 7;
        
        // Recent patterns - hours and minutes are definitely recent
        if (timeStr.includes('hour') || timeStr.includes('minute') || timeStr.includes('second')) {
            return true;
        }
        
        // Check days
        if (timeStr.includes('day')) {
            const dayMatch = timeStr.match(/(\d+)\s*day/);
            if (dayMatch) {
                const days = parseInt(dayMatch[1]);
                return days <= thresholdDays;
            }
            return true; // Generic "day" or "1 day"
        }
        
        // Check weeks
        if (timeStr.includes('week')) {
            const weekMatch = timeStr.match(/(\d+)\s*week/);
            if (weekMatch) {
                const weeks = parseInt(weekMatch[1]);
                return weeks <= this.config.recent_threshold_weeks;
            }
            return true; // Generic "week"
        }
        
        // Months are typically too old for our filter
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
            titles: [],
            salesTitles: [],
            marketingTitles: [],
            bdTitles: []
        };
        
        // Sales patterns (comprehensive international variations)
        const salesPatterns = [
            'sales', 'account executive', 'account manager', 'commercial', 'ae', 'am',
            'business development representative', 'bdr', 'sdr', 'sales development',
            'revenue', 'hunter', 'closer', 'sales rep', 'sales representative',
            'inside sales', 'outside sales', 'field sales', 'territory manager',
            'regional sales', 'enterprise sales', 'corporate sales', 'key account',
            'senior account', 'strategic account', 'client executive', 'relationship manager',
            'sales director', 'sales manager', 'sales lead', 'sales specialist',
            'sales consultant', 'solution selling', 'technical sales', 'pre-sales',
            // French variations
            'vendeur', 'vente', 'commercial', 'responsable commercial', 'chargé commercial',
            'directeur commercial', 'ingénieur commercial', 'technico-commercial',
            // German variations
            'vertrieb', 'verkauf', 'sales manager', 'account manager', 'key account manager',
            // Spanish variations
            'ventas', 'ejecutivo de ventas', 'gerente de ventas', 'representante de ventas'
        ];
        
        // Marketing patterns (comprehensive variations)
        const marketingPatterns = [
            'marketing', 'growth', 'demand gen', 'demand generation', 'content', 'brand',
            'digital marketing', 'product marketing', 'pmm', 'seo', 'sem', 'ppc',
            'social media', 'campaign', 'martech', 'marketing automation', 'crm marketing',
            'email marketing', 'performance marketing', 'acquisition', 'retention',
            'lifecycle marketing', 'growth marketing', 'growth hacking', 'conversion',
            'marketing manager', 'marketing director', 'marketing lead', 'marketing specialist',
            'brand manager', 'content manager', 'community manager', 'social media manager',
            'marketing coordinator', 'marketing analyst', 'marketing operations', 'marops',
            'field marketing', 'event marketing', 'trade marketing', 'channel marketing',
            'partner marketing', 'alliance marketing', 'co-marketing', 'influencer marketing',
            // French variations
            'marketing', 'responsable marketing', 'chargé marketing', 'directeur marketing',
            'chef de produit', 'brand manager', 'communication', 'webmarketing',
            // German variations
            'marketing', 'produktmanager', 'brand manager', 'marketingleiter',
            // Spanish variations
            'marketing', 'mercadeo', 'gerente de marketing', 'especialista en marketing'
        ];
        
        // Business Development patterns (comprehensive variations)
        const bdPatterns = [
            'business development', 'bd manager', 'biz dev', 'bizdev', 'business dev',
            'partnership', 'partnerships', 'partner manager', 'alliance manager',
            'strategic partnership', 'strategic alliance', 'channel', 'channel manager',
            'channel partner', 'ecosystem', 'partner development', 'alliances',
            'business development manager', 'business development director', 
            'business development lead', 'business development representative',
            'strategic business development', 'corporate development', 'corp dev',
            'venture partnerships', 'strategic initiatives', 'new business development',
            'market development', 'territory development', 'channel development',
            // French variations
            'développement commercial', 'business development', 'développement des affaires',
            'partenariats', 'alliances stratégiques', 'développement partenaire',
            // German variations
            'business development', 'geschäftsentwicklung', 'partnermanager',
            // Spanish variations
            'desarrollo de negocios', 'desarrollo comercial', 'alianzas estratégicas'
        ];
        
        jobs.forEach(job => {
            const title = (job.title || '').toLowerCase();
            roleAnalysis.titles.push(job.title);
            
            // Check for sales roles
            if (salesPatterns.some(pattern => title.includes(pattern))) {
                roleAnalysis.hasSales = true;
                roleAnalysis.salesTitles.push(job.title);
            }
            
            // Check for marketing roles
            if (marketingPatterns.some(pattern => title.includes(pattern))) {
                roleAnalysis.hasMarketing = true;
                roleAnalysis.marketingTitles.push(job.title);
            }
            
            // Check for BD roles
            if (bdPatterns.some(pattern => title.includes(pattern))) {
                roleAnalysis.hasBusinessDevelopment = true;
                roleAnalysis.bdTitles.push(job.title);
            }
        });
        
        return roleAnalysis;
    }

    calculateHiringUrgency(recentJobs) {
        if (recentJobs.length === 0) return 'None';
        
        // Check for very recent posts (within days)
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
        
        const recentJobRate = this.results.processed > 0
            ? ((this.results.withRecentJobs / this.results.processed) * 100).toFixed(1)
            : 0;
            
        console.log(`\n   📊 Job Analysis Summary:`);
        console.log(`      Processed: ${this.results.processed} companies`);
        console.log(`      API Success: ${this.results.successful} (${successRate}%)`);
        console.log(`      With target role jobs: ${this.results.withRecentJobs} (${recentJobRate}%)`);
        console.log(`      With sales jobs: ${this.results.withSalesJobs}`);
        console.log(`      With marketing jobs: ${this.results.withMarketingJobs}`);
        console.log(`      With BD jobs: ${this.results.withBDJobs}`);
        console.log(`      Errors: ${this.results.errors.length}`);
        
        return {
            results: [],
            summary: {
                processed: this.results.processed,
                successful: this.results.successful,
                successRate: successRate,
                qualifiedCount: this.results.withRecentJobs,
                errorCount: this.results.errors.length,
                details: {
                    withRecentJobs: this.results.withRecentJobs,
                    withSalesJobs: this.results.withSalesJobs,
                    withMarketingJobs: this.results.withMarketingJobs,
                    withBDJobs: this.results.withBDJobs,
                    recentJobRate: recentJobRate
                }
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = JobAnalyzer;