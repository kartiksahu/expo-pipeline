/**
 * Enhanced Funding Analysis Module
 * Combines original LinkedIn API with Phase 1 fallback mechanisms
 * Uses scraping fallbacks when API data is insufficient
 */

const axios = require('axios');
const FundingScraperFallback = require('./funding-scraper-fallback');

class FundingAnalyzerEnhanced {
    constructor(stageConfig, apiSettings) {
        this.config = stageConfig;
        this.api = apiSettings;
        this.fallbackScraper = new FundingScraperFallback({
            timeout: 10000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            recentThresholdMonths: stageConfig.recent_threshold_months || 12
        });
        
        this.results = {
            processed: 0,
            successful: 0,
            withFunding: 0,
            withRecentFunding: 0,
            fallbackUsed: 0,
            fallbackSuccessful: 0,
            errors: []
        };
    }

    async process(companies) {
        console.log(`   💰 Enhanced Funding Analysis for ${companies.length} companies...`);
        console.log(`   📅 Recent funding threshold: ${this.config.recent_threshold_months} months`);
        console.log(`   🔄 Fallback scraping enabled for insufficient data`);
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`   [${i + 1}/${companies.length}] ${company.name || company.companyName}`);
            
            try {
                // Step 1: Try primary LinkedIn API method
                let fundingData = await this.getFundingDataWithRetry(company);
                let usedFallback = false;
                
                // Step 2: Check if primary data is sufficient
                const needsFallback = this.shouldUseFallback(fundingData, company);
                
                if (needsFallback) {
                    console.log(`     🔄 Primary API insufficient, trying fallback methods...`);
                    this.results.fallbackUsed++;
                    
                    // Step 3: Use fallback scraping methods
                    const fallbackData = await this.fallbackScraper.findFundingData(company);
                    
                    if (fallbackData.found) {
                        // Merge fallback data with primary data
                        fundingData = this.mergeFallbackData(fundingData, fallbackData);
                        this.results.fallbackSuccessful++;
                        usedFallback = true;
                        console.log(`     ✅ Fallback methods found funding data (${fallbackData.sources.join(', ')})`);
                    } else {
                        console.log(`     ❌ Fallback methods found no additional data`);
                    }
                }
                
                // Add funding flags to company
                company.has_funding_data = fundingData.has_funding_data;
                company.has_recent_funding_1yr = fundingData.has_recent_funding_1yr;
                company.funding_details = fundingData.funding_details;
                company.last_funding_date = fundingData.last_funding_date;
                company.crunchbase_url = fundingData.crunchbase_url;
                company.funding_rounds = fundingData.funding_rounds;
                company.total_funding = fundingData.total_funding;
                company.funding_data_sources = fundingData.data_sources;
                company.funding_confidence = fundingData.confidence;
                
                this.results.processed++;
                if (fundingData.api_success || usedFallback) {
                    this.results.successful++;
                }
                
                if (fundingData.has_funding_data) {
                    this.results.withFunding++;
                    console.log(`     💰 Funding data found (${fundingData.data_sources.join(', ')})`);
                }
                
                if (fundingData.has_recent_funding_1yr) {
                    this.results.withRecentFunding++;
                    console.log(`     🆕 Recent funding detected: ${fundingData.last_funding_date}`);
                }
                
                // Rate limiting
                if (i < companies.length - 1) {
                    await this.delay(usedFallback ? 3000 : 1000); // Longer delay if used scraping
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                
                // Set default values for failed companies
                company.has_funding_data = false;
                company.has_recent_funding_1yr = false;
                company.funding_details = '';
                company.last_funding_date = '';
                company.crunchbase_url = '';
                company.funding_rounds = '';
                company.total_funding = '';
                company.funding_data_sources = '';
                company.funding_confidence = 0;
                
                this.results.errors.push({ company: company.name, error: error.message });
                this.results.processed++;
            }
        }
        
        return this.generateSummary();
    }

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
                company_url: linkedinUrl
            }
        };

        try {
            const response = await axios.request(options);
            const companyData = response.data.response?.data || {};
            
            // Extract Crunchbase funding data
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
                confidence: 0.8 // High confidence for API data
            };
            
        } catch (error) {
            // Try with different parameter format
            if (error.response?.status === 400) {
                options.data.link = options.data.company_url;
                delete options.data.company_url;
                
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
            }
            throw error;
        }
    }

    shouldUseFallback(primaryData, company) {
        // Use fallback if:
        // 1. API failed completely
        // 2. No funding data found but company seems well-funded (large employee count, etc.)
        // 3. Company has indicators of funding but API missed it
        
        if (!primaryData.api_success) return true;
        
        if (!primaryData.has_funding_data && company.employee_count > 50) return true;
        
        if (!primaryData.has_recent_funding_1yr && company.employee_count > 100) return true;
        
        return false;
    }

    mergeFallbackData(primaryData, fallbackData) {
        const merged = { ...primaryData };
        
        // Merge data sources
        merged.data_sources = [...(primaryData.data_sources || []), ...fallbackData.sources];
        
        // Update funding flags if fallback found data
        merged.has_funding_data = merged.has_funding_data || fallbackData.found;
        merged.has_recent_funding_1yr = merged.has_recent_funding_1yr || fallbackData.recentFunding;
        
        // Merge funding details
        const primaryDetails = primaryData.funding_details ? [primaryData.funding_details] : [];
        const fallbackDetails = fallbackData.details.map(d => `${d.text} (${d.source})`);
        const allDetails = [...primaryDetails, ...fallbackDetails];
        merged.funding_details = allDetails.slice(0, 3).join(' | ');
        
        // Use fallback date if more recent
        if (fallbackData.lastFundingDate && 
            (!primaryData.last_funding_date || fallbackData.lastFundingDate > primaryData.last_funding_date)) {
            merged.last_funding_date = fallbackData.lastFundingDate;
        }
        
        // Merge total funding info
        if (fallbackData.totalAmount && !primaryData.total_funding) {
            merged.total_funding = fallbackData.totalAmount;
        }
        
        // Adjust confidence based on data sources
        merged.confidence = (primaryData.confidence + fallbackData.confidence) / 2;
        
        return merged;
    }

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
        
        // Simple aggregation - could be enhanced for better parsing
        return amounts.join(' + ');
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
        
        const fundingRate = this.results.processed > 0
            ? ((this.results.withFunding / this.results.processed) * 100).toFixed(1)
            : 0;
        
        const recentFundingRate = this.results.processed > 0
            ? ((this.results.withRecentFunding / this.results.processed) * 100).toFixed(1)
            : 0;
            
        console.log(`\\n   💰 Enhanced Funding Analysis Summary:`);
        console.log(`      Processed: ${this.results.processed} companies`);
        console.log(`      Overall Success: ${this.results.successful} (${successRate}%)`);
        console.log(`      Fallback Usage: ${this.results.fallbackUsed} (${fallbackUsageRate}%)`);
        console.log(`      Fallback Success: ${this.results.fallbackSuccessful} (${fallbackSuccessRate}%)`);
        console.log(`      With funding data: ${this.results.withFunding} (${fundingRate}%)`);
        console.log(`      With recent funding: ${this.results.withRecentFunding} (${recentFundingRate}%)`);
        
        return {
            results: [],
            summary: {
                processed: this.results.processed,
                successful: this.results.successful,
                successRate: successRate,
                fallbackUsage: this.results.fallbackUsed,
                fallbackSuccessRate: fallbackSuccessRate,
                withFunding: this.results.withFunding,
                withRecentFunding: this.results.withRecentFunding,
                errorCount: this.results.errors.length
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = FundingAnalyzerEnhanced;