/**
 * Integrated Funding Analysis Module
 * Combines existing LinkedIn API with real fallback mechanisms
 * Professional integration - preserves all existing functionality
 */

const axios = require('axios');
const FundingScraperReal = require('./funding-scraper-real');
const UniversalWebSearch = require('./web-search-universal');

class FundingAnalyzerIntegrated {
    constructor(stageConfig, apiSettings) {
        // Preserve all existing configuration
        this.config = stageConfig;
        this.api = apiSettings;
        
        // Initialize fallback scrapers
        this.realScraper = new FundingScraperReal({
            timeout: 10000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            recentThresholdMonths: stageConfig.recent_threshold_months || 12
        });
        
        this.webSearch = new UniversalWebSearch({
            timeout: 15000,
            waitTime: 3000
        });
        
        // Preserve existing results structure
        this.results = {
            processed: 0,
            successful: 0,
            withFunding: 0,
            withRecentFunding: 0,
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
        console.log(`   💰 Enhanced Funding Analysis for ${companies.length} companies...`);
        console.log(`   📅 Recent funding threshold: ${this.config.recent_threshold_months} months`);
        console.log(`   🔄 Real fallback mechanisms enabled`);
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`   [${i + 1}/${companies.length}] ${company.name || company.companyName}`);
            
            try {
                // Step 1: Try existing LinkedIn API method (preserve original logic)
                let fundingData = null;
                let apiError = false;
                
                try {
                    fundingData = await this.getFundingDataWithRetry(company);
                } catch (apiErr) {
                    console.log(`     ❌ API failed: ${apiErr.message}`);
                    apiError = true;
                    // Initialize empty funding data for fallback
                    fundingData = {
                        has_funding_data: false,
                        has_recent_funding_1yr: false,
                        funding_details: '',
                        last_funding_date: '',
                        crunchbase_url: '',
                        funding_rounds: '',
                        total_funding: '',
                        data_sources: [],
                        confidence: 0
                    };
                }
                
                let usedFallback = false;
                let usedWebSearch = false;
                
                // Step 2: Check if we should use fallbacks (API error OR insufficient data)
                const needsFallback = apiError || this.shouldUseFallback(fundingData, company);
                
                if (needsFallback) {
                    const reason = apiError ? "API failed, trying real fallback methods..." : "API data insufficient, trying real fallback methods...";
                    console.log(`     🔄 ${reason}`);
                    this.results.fallbackUsed++;
                    
                    // Try real scraping fallbacks
                    const fallbackData = await this.realScraper.findFundingData(company);
                    
                    if (fallbackData.found) {
                        fundingData = this.mergeFallbackData(fundingData, fallbackData, 'scraping');
                        this.results.fallbackSuccessful++;
                        usedFallback = true;
                        console.log(`     ✅ Real scraping found data: ${fallbackData.sources.join(', ')}`);
                    }
                    
                    // Step 3: Try web search if still insufficient (most conservative)
                    const stillNeedsMore = !fundingData.has_funding_data && company.employee_count > 100;
                    
                    if (stillNeedsMore) {
                        console.log(`     🌐 Trying web search as last resort...`);
                        this.results.webSearchUsed++;
                        
                        const webData = await this.webSearch.searchFundingAnnouncements(company.name);
                        
                        if (webData.found) {
                            fundingData = this.mergeFallbackData(fundingData, webData, 'web_search');
                            this.results.webSearchSuccessful++;
                            usedWebSearch = true;
                            console.log(`     ✅ Web search found additional funding signals`);
                        }
                    }
                }
                
                // Preserve existing company data structure
                company.has_funding_data = fundingData.has_funding_data;
                company.has_recent_funding_1yr = fundingData.has_recent_funding_1yr;
                company.funding_details = fundingData.funding_details;
                company.last_funding_date = fundingData.last_funding_date;
                company.crunchbase_url = fundingData.crunchbase_url;
                company.funding_rounds = fundingData.funding_rounds;
                company.total_funding = fundingData.total_funding;
                
                // Add new fields for data source tracking
                company.funding_data_sources = fundingData.data_sources || [];
                company.funding_confidence = fundingData.confidence || 0;
                
                // Update results (preserve existing logic)
                this.results.processed++;
                if (fundingData.api_success || usedFallback || usedWebSearch) {
                    this.results.successful++;
                }
                
                if (fundingData.has_funding_data) {
                    this.results.withFunding++;
                    const sourceInfo = usedFallback ? ' (enhanced)' : '';
                    console.log(`     💰 Funding data found${sourceInfo}`);
                }
                
                if (fundingData.has_recent_funding_1yr) {
                    this.results.withRecentFunding++;
                    console.log(`     🆕 Recent funding: ${fundingData.last_funding_date}`);
                }
                
                // Rate limiting (conservative)
                if (i < companies.length - 1) {
                    const delay = usedWebSearch ? 5000 : (usedFallback ? 3000 : 1000);
                    await this.delay(delay);
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                
                // Preserve existing error handling
                company.has_funding_data = false;
                company.has_recent_funding_1yr = false;
                company.funding_details = '';
                company.last_funding_date = '';
                company.crunchbase_url = '';
                company.funding_rounds = '';
                company.total_funding = '';
                company.funding_data_sources = [];
                company.funding_confidence = 0;
                
                this.results.errors.push({ company: company.name, error: error.message });
                this.results.processed++;
            }
        }
        
        return this.generateSummary();
    }

    /**
     * Existing API method - preserved exactly
     */
    async getFundingDataWithRetry(company, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            return await this.getFundingData(company);
        } catch (error) {
            if (error.response && error.response.status === 429 && retryCount < maxRetries) {
                const backoffDelay = Math.pow(2, retryCount) * 1000;
                console.log(`     ⏳ Rate limited. Retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await this.delay(backoffDelay);
                return this.getFundingDataWithRetry(company, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Existing API method - preserved exactly
     */
    async getFundingData(company) {
        if (!company.linkedin_url && !company.linkedin) {
            throw new Error('No LinkedIn URL available for funding analysis');
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
                link: linkedinUrl
            }
        };

        try {
            const response = await axios.request(options);
            const companyData = response.data.response?.data || {};
            
            const crunchbaseData = companyData.crunchbase || {};
            const fundingRounds = crunchbaseData.funding_rounds || [];
            
            const hasFundingData = fundingRounds.length > 0;
            const recentFunding = this.hasRecentFunding(fundingRounds);
            
            return {
                api_success: true,
                has_funding_data: hasFundingData,
                has_recent_funding_1yr: recentFunding,
                funding_details: this.formatFundingDetails(fundingRounds),
                last_funding_date: this.getLastFundingDate(fundingRounds),
                crunchbase_url: crunchbaseData.crunchbase_url || '',
                funding_rounds: fundingRounds.length.toString(),
                total_funding: this.calculateTotalFunding(fundingRounds),
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
        
        // Well-funded companies should have funding data
        if (!primaryData.has_funding_data && company.employee_count > 50) return true;
        
        // Large companies without recent funding is unusual
        if (!primaryData.has_recent_funding_1yr && company.employee_count > 150) return true;
        
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
        
        // Update funding flags if fallback found data
        merged.has_funding_data = merged.has_funding_data || fallbackData.found;
        merged.has_recent_funding_1yr = merged.has_recent_funding_1yr || fallbackData.recentFunding;
        
        // Merge funding details
        const primaryDetails = primaryData.funding_details ? [primaryData.funding_details] : [];
        const fallbackDetails = (fallbackData.details || []).map(d => `${d.text.substring(0, 100)}...`);
        const allDetails = [...primaryDetails, ...fallbackDetails];
        merged.funding_details = allDetails.slice(0, 2).join(' | ');
        
        // Use fallback date if more recent or primary is missing
        if (fallbackData.lastFundingDate && 
            (!primaryData.last_funding_date || fallbackData.lastFundingDate > primaryData.last_funding_date)) {
            merged.last_funding_date = fallbackData.lastFundingDate;
        }
        
        // Merge funding amounts
        if (fallbackData.totalAmount && !primaryData.total_funding) {
            merged.total_funding = fallbackData.totalAmount;
        }
        
        // Merge funding rounds count
        const fallbackRounds = (fallbackData.fundingRounds || []).length;
        if (fallbackRounds > 0 && !primaryData.funding_rounds) {
            merged.funding_rounds = fallbackRounds.toString();
        }
        
        // Adjust confidence
        const fallbackConfidence = fallbackData.confidence || 0.4;
        merged.confidence = Math.min(1.0, (primaryData.confidence + fallbackConfidence) / 2);
        
        return merged;
    }

    // Preserve all existing methods exactly
    hasRecentFunding(fundingRounds) {
        if (fundingRounds.length === 0) return false;
        
        const thresholdDate = new Date();
        thresholdDate.setMonth(thresholdDate.getMonth() - this.config.recent_threshold_months);
        
        return fundingRounds.some(round => {
            const roundDate = new Date(round.announced_on || round.date);
            return !isNaN(roundDate) && roundDate > thresholdDate;
        });
    }

    formatFundingDetails(fundingRounds) {
        if (fundingRounds.length === 0) return '';
        
        const details = fundingRounds
            .slice(0, 3) // Latest 3 rounds
            .map(round => {
                const type = round.funding_type || round.investment_type || 'funding';
                const amount = round.money_raised || round.amount || '';
                const date = round.announced_on || round.date || '';
                
                return `${type}${amount ? `: ${amount}` : ''}${date ? ` (${date})` : ''}`;
            });
        
        return details.join(' | ');
    }

    getLastFundingDate(fundingRounds) {
        if (fundingRounds.length === 0) return '';
        
        const dates = fundingRounds
            .map(round => round.announced_on || round.date)
            .filter(date => date)
            .map(date => new Date(date))
            .filter(date => !isNaN(date))
            .sort((a, b) => b - a);
        
        return dates.length > 0 ? dates[0].toISOString().split('T')[0] : '';
    }

    calculateTotalFunding(fundingRounds) {
        const amounts = fundingRounds
            .map(round => round.money_raised || round.amount)
            .filter(amount => amount);
        
        if (amounts.length === 0) return '';
        
        return amounts.join(' + ');
    }

    generateSummary() {
        const successRate = this.results.processed > 0 
            ? ((this.results.successful / this.results.processed) * 100).toFixed(1)
            : 0;
        
        const enhancementRate = this.results.processed > 0
            ? (((this.results.fallbackUsed + this.results.webSearchUsed) / this.results.processed) * 100).toFixed(1)
            : 0;
        
        const fundingRate = this.results.processed > 0
            ? ((this.results.withFunding / this.results.processed) * 100).toFixed(1)
            : 0;
            
        console.log(`\\n   💰 Enhanced Funding Analysis Summary:`);
        console.log(`      Processed: ${this.results.processed} companies`);
        console.log(`      Success Rate: ${this.results.successful} (${successRate}%)`);
        console.log(`      Enhanced: ${this.results.fallbackUsed + this.results.webSearchUsed} (${enhancementRate}%)`);
        console.log(`      Real Scraping: ${this.results.fallbackSuccessful}/${this.results.fallbackUsed}`);
        console.log(`      Web Search: ${this.results.webSearchSuccessful}/${this.results.webSearchUsed}`);
        console.log(`      With funding: ${this.results.withFunding} (${fundingRate}%)`);
        console.log(`      Recent funding: ${this.results.withRecentFunding}`);
        
        return {
            results: [],
            summary: {
                processed: this.results.processed,
                successful: this.results.successful,
                successRate: successRate,
                withFunding: this.results.withFunding,
                withRecentFunding: this.results.withRecentFunding,
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

module.exports = FundingAnalyzerIntegrated;