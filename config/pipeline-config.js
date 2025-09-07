/**
 * Pipeline Configuration
 * Controls which analyzers to use and their settings
 */

module.exports = {
    // Pipeline Mode: 'standard' or 'enhanced'
    mode: 'enhanced', // Change to 'standard' to disable fallback scraping
    
    // Enhanced Mode Settings
    enhanced: {
        // Enable specific fallback methods
        enableJobFallbacks: true,
        enableFundingFallbacks: true,
        
        // Fallback trigger conditions
        jobFallback: {
            // Use fallback if API returns 0 jobs for companies with >20 employees
            triggerOnZeroJobsMinEmployees: 20,
            // Use fallback if API returns <2 jobs for companies with >50 employees
            triggerOnLowJobsMinEmployees: 50,
            triggerOnLowJobsThreshold: 2
        },
        
        fundingFallback: {
            // Use fallback if no funding data for companies with >50 employees
            triggerOnNoFundingMinEmployees: 50,
            // Use fallback if no recent funding for companies with >100 employees
            triggerOnNoRecentFundingMinEmployees: 100
        },
        
        // Rate limiting for scraping (more conservative)
        rateLimiting: {
            careerPageScraping: 2000,    // 2 second delays
            socialMediaChecks: 3000,     // 3 second delays
            newsSearches: 2500,          // 2.5 second delays
            maxConcurrentScraping: 2     // Max 2 parallel scraping requests
        }
    },
    
    // Analyzer Selection
    analyzers: {
        job: {
            standard: './job-analyzer.js',
            enhanced: './job-analyzer-enhanced.js'
        },
        funding: {
            standard: './funding-analyzer.js', 
            enhanced: './funding-analyzer-enhanced.js'
        }
    },
    
    // Data Quality Settings
    dataQuality: {
        // Minimum confidence score to trust scraped data
        minimumScrapingConfidence: 0.3,
        
        // Maximum age for cached scraping results (hours)
        scrapingCacheMaxAge: 24,
        
        // Enable data source tracking
        trackDataSources: true
    },
    
    // Logging and Monitoring
    logging: {
        enableFallbackLogs: true,
        enableTimingLogs: true,
        enableDetailedErrors: true
    }
};