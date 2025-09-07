/**
 * Funding Analysis Module
 * Analyzes company funding information and flags recent funding (within 1 year)
 * Based on proven BigData Paris funding analysis methodology
 */

const axios = require('axios');

class FundingAnalyzer {
    constructor(stageConfig, apiSettings) {
        this.config = stageConfig;
        this.api = apiSettings;
        this.results = {
            processed: 0,
            successful: 0,
            withFundingData: 0,
            withRecentFunding: 0,
            errors: []
        };
    }

    async process(companies) {
        console.log(`   📊 Analyzing funding data for ${companies.length} companies...`);
        console.log(`   🎯 Recent funding threshold: ${this.config.recent_threshold_months} months`);
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`   [${i + 1}/${companies.length}] ${company.name || company.companyName}`);
            
            try {
                const fundingData = await this.getFundingDataWithRetry(company);
                
                // Add funding flags to company (NOT FILTERING)
                company.has_funding_data = fundingData.has_funding_data;
                company.has_recent_funding_1yr = fundingData.has_recent_funding_1yr;
                company.funding_details = fundingData.funding_details;
                company.last_funding_date = fundingData.last_funding_date;
                company.crunchbase_url = fundingData.crunchbase_url;
                company.funding_rounds = fundingData.funding_rounds;
                company.total_funding = fundingData.total_funding;
                
                this.results.processed++;
                if (fundingData.api_success) {
                    this.results.successful++;
                }
                if (fundingData.has_funding_data) {
                    this.results.withFundingData++;
                    console.log(`     💰 Funding data found`);
                }
                if (fundingData.has_recent_funding_1yr) {
                    this.results.withRecentFunding++;
                    console.log(`     🚀 Recent funding (within 1 year): ${fundingData.last_funding_date}`);
                }
                
                // Rate limiting (reduced to 1 second)
                if (i < companies.length - 1) {
                    await this.delay(1000);
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                
                // Still keep the company, just mark funding fields
                company.has_funding_data = false;
                company.has_recent_funding_1yr = false;
                company.funding_details = '';
                company.last_funding_date = '';
                company.crunchbase_url = '';
                company.funding_rounds = '';
                company.total_funding = '';
                
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
            // Check if it's a rate limit error (429) and we have retries left
            if (error.response && error.response.status === 429 && retryCount < maxRetries) {
                const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
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
                link: linkedinUrl
            }
        };

        const response = await axios.request(options);
        const data = response.data.data || response.data;

        // Extract funding information
        const fundingInfo = this.extractFundingInfo(data);
        
        // Check if funding is recent (within threshold)
        const isRecentFunding = this.checkRecentFunding(fundingInfo, this.config.recent_threshold_months);
        
        // Generate funding details summary
        const fundingDetails = this.generateFundingDetails(fundingInfo);
        
        console.log(`     💼 Company stage: ${fundingInfo.companyStage || 'Unknown'}`);
        
        return {
            api_success: true,
            has_funding_data: fundingInfo.hasFundingData,
            has_recent_funding_1yr: isRecentFunding,
            funding_details: fundingDetails,
            last_funding_date: fundingInfo.lastFundingDate || '',
            crunchbase_url: fundingInfo.crunchbaseUrl || '',
            funding_rounds: fundingInfo.numberOfRounds || '',
            total_funding: fundingInfo.totalFunding || ''
        };
    }

    extractFundingInfo(data) {
        const fundingInfo = {
            hasFundingData: false,
            crunchbaseFundingData: null,
            totalFunding: null,
            numberOfRounds: null,
            lastFundingDate: null,
            investors: null,
            companyStage: null,
            crunchbaseUrl: null,
            founded: null
        };

        // Check Crunchbase integration
        if (data.crunchbaseFundingData) {
            fundingInfo.hasFundingData = true;
            fundingInfo.crunchbaseFundingData = data.crunchbaseFundingData;
            
            // Extract from Crunchbase data
            if (typeof data.crunchbaseFundingData === 'object') {
                fundingInfo.numberOfRounds = data.crunchbaseFundingData.numberOfFundingRounds || null;
                fundingInfo.crunchbaseUrl = data.crunchbaseFundingData.organizationUrl || null;
                
                // Try to extract funding date from Crunchbase data
                if (data.crunchbaseFundingData.lastFunding) {
                    fundingInfo.lastFundingDate = this.parseFundingDate(data.crunchbaseFundingData.lastFunding);
                }
            }
        }

        // Check other funding fields
        const fundingFields = [
            'funding_info', 'fundingInfo', 'funding', 'fundingData',
            'total_funding', 'totalFunding', 'funding_rounds', 'fundingRounds',
            'last_funding', 'lastFunding', 'recent_funding', 'investors'
        ];

        fundingFields.forEach(field => {
            if (data[field]) {
                fundingInfo.hasFundingData = true;
                
                // Capture specific values
                if (field.includes('total')) {
                    fundingInfo.totalFunding = data[field];
                }
                if (field.includes('rounds')) {
                    fundingInfo.numberOfRounds = data[field];
                }
                if (field.includes('last') || field.includes('recent')) {
                    const date = this.parseFundingDate(data[field]);
                    if (date) {
                        fundingInfo.lastFundingDate = date;
                    }
                }
                if (field === 'investors') {
                    fundingInfo.investors = data[field];
                }
            }
        });

        // Determine company stage based on available data
        if (data.founded || data.foundedYear) {
            const foundedYear = parseInt(data.founded || data.foundedYear);
            if (foundedYear) {
                const age = new Date().getFullYear() - foundedYear;
                fundingInfo.founded = foundedYear;
                
                if (age <= 3) fundingInfo.companyStage = 'Early Stage';
                else if (age <= 7) fundingInfo.companyStage = 'Growth Stage';
                else if (age <= 15) fundingInfo.companyStage = 'Mature';
                else fundingInfo.companyStage = 'Established';
            }
        }

        return fundingInfo;
    }

    checkRecentFunding(fundingInfo, thresholdMonths) {
        if (!fundingInfo.hasFundingData || !fundingInfo.lastFundingDate) {
            return false;
        }

        try {
            // Parse the funding date
            const fundingDate = new Date(fundingInfo.lastFundingDate);
            const now = new Date();
            
            // Calculate months difference
            const monthsDiff = (now.getFullYear() - fundingDate.getFullYear()) * 12 + 
                              (now.getMonth() - fundingDate.getMonth());
            
            return monthsDiff <= thresholdMonths;
            
        } catch (error) {
            // If we can't parse the date, check for text indicators
            const dateText = fundingInfo.lastFundingDate.toLowerCase();
            
            // Check for recent indicators in text
            if (dateText.includes('2024') || dateText.includes('2025')) {
                return true;
            }
            if (dateText.includes('recent') || dateText.includes('this year') || dateText.includes('last year')) {
                return true;
            }
            
            return false;
        }
    }

    parseFundingDate(dateString) {
        if (!dateString) return null;
        
        // Try to extract year from string
        const yearMatch = dateString.match(/20\d{2}/);
        if (yearMatch) {
            // If we have month info too
            const monthMatch = dateString.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
            if (monthMatch) {
                return `${monthMatch[0]} ${yearMatch[0]}`;
            }
            return yearMatch[0];
        }
        
        // Try to parse as date
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            // Not a valid date
        }
        
        return dateString; // Return original if can't parse
    }

    generateFundingDetails(fundingInfo) {
        const details = [];
        
        if (fundingInfo.numberOfRounds) {
            details.push(`${fundingInfo.numberOfRounds} rounds`);
        }
        if (fundingInfo.totalFunding) {
            details.push(`Total: ${fundingInfo.totalFunding}`);
        }
        if (fundingInfo.lastFundingDate) {
            details.push(`Last: ${fundingInfo.lastFundingDate}`);
        }
        if (fundingInfo.companyStage) {
            details.push(`Stage: ${fundingInfo.companyStage}`);
        }
        
        return details.join(' | ');
    }

    generateSummary() {
        const successRate = this.results.processed > 0 
            ? ((this.results.successful / this.results.processed) * 100).toFixed(1)
            : 0;
        
        const fundingRate = this.results.processed > 0
            ? ((this.results.withFundingData / this.results.processed) * 100).toFixed(1)
            : 0;
            
        const recentFundingRate = this.results.withFundingData > 0
            ? ((this.results.withRecentFunding / this.results.withFundingData) * 100).toFixed(1)
            : 0;
            
        console.log(`\n   📊 Funding Analysis Summary:`);
        console.log(`      Processed: ${this.results.processed} companies`);
        console.log(`      API Success: ${this.results.successful} (${successRate}%)`);
        console.log(`      With funding data: ${this.results.withFundingData} (${fundingRate}%)`);
        console.log(`      Recent funding (1yr): ${this.results.withRecentFunding} (${recentFundingRate}% of funded)`);
        console.log(`      Errors: ${this.results.errors.length}`);
        
        return {
            results: [],
            summary: {
                processed: this.results.processed,
                successful: this.results.successful,
                successRate: successRate,
                qualifiedCount: this.results.withRecentFunding,
                errorCount: this.results.errors.length,
                details: {
                    withFundingData: this.results.withFundingData,
                    withRecentFunding: this.results.withRecentFunding,
                    fundingRate: fundingRate,
                    recentFundingRate: recentFundingRate
                }
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = FundingAnalyzer;