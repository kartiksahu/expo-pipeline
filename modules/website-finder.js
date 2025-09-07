/**
 * Website Finder Module
 * Finds official company websites through multiple search strategies
 * Runs before LinkedIn enhancement to maximize LinkedIn discovery
 */

const axios = require('axios');
const UniversalWebSearch = require('./web-search-universal');
const cheerio = require('cheerio');

class WebsiteFinder {
    constructor(stageConfig, apiSettings) {
        this.config = stageConfig;
        this.api = apiSettings;
        
        // Initialize universal web search
        this.webSearch = new UniversalWebSearch({
            timeout: 15000,
            waitTime: 2000
        });
        
        this.results = {
            processed: 0,
            found: 0,
            alreadyHadWebsite: 0,
            foundViaSearch: 0,
            foundViaPattern: 0,
            verified: 0,
            notFound: 0,
            errors: []
        };
    }

    async process(companies) {
        console.log(`   📊 Finding websites for ${companies.length} companies...`);
        
        // Step 1: Consolidate website columns and validate
        console.log(`   🔄 Consolidating website columns...`);
        let validExisting = 0;
        let invalidExisting = 0;
        
        for (const company of companies) {
            // Check all possible website column names
            const possibleWebsite = 
                company.website || 
                company.Website || 
                company['Company Website'] || 
                company['company_website'] || 
                company.url || 
                company.URL || 
                '';
            
            // Validate if it's a real website URL
            if (this.isValidWebsiteUrl(possibleWebsite)) {
                company.website = this.cleanWebsiteUrl(possibleWebsite);
                company.website_source = 'existing_valid';
                validExisting++;
            } else if (possibleWebsite && !this.isPlaceholder(possibleWebsite)) {
                // Has something but it's not valid
                console.log(`   ⚠️  Invalid website URL for ${company.name}: ${possibleWebsite}`);
                company.website = '';
                company.website_source = 'invalid_existing';
                invalidExisting++;
            } else {
                // Empty or placeholder
                company.website = '';
                company.website_source = '';
            }
        }
        
        console.log(`   ✅ Found ${validExisting} valid existing websites`);
        if (invalidExisting > 0) {
            console.log(`   ⚠️  Found ${invalidExisting} invalid website URLs that need replacement`);
        }
        
        this.results.alreadyHadWebsite = validExisting;
        
        // Step 2: Find websites for companies that don't have them
        const needsWebsite = companies.filter(c => !c.website || c.website.trim() === '');
        
        if (needsWebsite.length === 0) {
            console.log(`   ✅ All companies already have websites`);
            return this.generateSummary();
        }
        
        console.log(`   🔍 ${needsWebsite.length} companies need websites`);
        console.log(`   ⏩ ${companies.length - needsWebsite.length} companies already have websites`);
        
        // Process companies that need websites
        for (let i = 0; i < needsWebsite.length; i++) {
            const company = needsWebsite[i];
            console.log(`   [${i + 1}/${needsWebsite.length}] ${company.name || company.companyName}`);
            
            try {
                // Try to find website
                const websiteResult = await this.findWebsite(company);
                
                if (websiteResult) {
                    company.website = websiteResult.url;
                    company.website_source = websiteResult.source;
                    this.results.found++;
                    
                    if (websiteResult.source === 'web_search') {
                        this.results.foundViaSearch++;
                        console.log(`     ✅ Found via web search: ${websiteResult.url}`);
                    } else if (websiteResult.source === 'pattern_match') {
                        this.results.foundViaPattern++;
                        console.log(`     ✅ Found via pattern matching: ${websiteResult.url}`);
                    }
                    
                    if (websiteResult.verified) {
                        this.results.verified++;
                    }
                } else {
                    company.website = '';
                    company.website_source = 'not_found';
                    this.results.notFound++;
                    console.log(`     ❌ Website not found`);
                }
                
                this.results.processed++;
                
                // Rate limiting
                if (i < needsWebsite.length - 1) {
                    await this.delay(500); // Faster for website searches
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                company.website = '';
                company.website_source = 'error';
                this.results.errors.push({ company: company.name, error: error.message });
                this.results.processed++;
            }
        }
        
        return this.generateSummary();
    }

    async findWebsite(company) {
        const companyName = company.name || company.companyName || '';
        
        // Step 1: Try universal web search
        console.log(`     🔍 Searching for website...`);
        const websiteFromSearch = await this.webSearch.searchForWebsite(companyName);
        if (websiteFromSearch) {
            // Verify the website exists
            if (await this.verifyWebsite(websiteFromSearch)) {
                return { url: websiteFromSearch, source: 'web_search', verified: true };
            }
        }
        
        // Step 2: Try common domain patterns
        console.log(`     🎯 Trying domain patterns...`);
        const websiteFromPattern = await this.tryCommonPatterns(companyName);
        if (websiteFromPattern) {
            return { url: websiteFromPattern, source: 'pattern_match', verified: true };
        }
        
        return null;
    }

    // searchForWebsite method removed - now using UniversalWebSearch module

    async tryCommonPatterns(companyName) {
        const cleanName = this.cleanCompanyName(companyName);
        
        // Handle special cases
        const specialCases = {
            // Add known company -> website mappings if needed
        };
        
        if (specialCases[cleanName.toLowerCase()]) {
            return specialCases[cleanName.toLowerCase()];
        }
        
        // Try variations with common words removed
        const variations = [
            cleanName,
            cleanName.replace(/\s+(group|solutions|technologies|systems|software|services)$/i, ''),
            cleanName.replace(/^(the|le|la)\s+/i, ''),
            // Try initials for long names
            cleanName.split(' ').map(w => w[0]).join('').toLowerCase()
        ];
        
        for (const variant of variations) {
            if (variant && variant.length > 2) {
                const urls = [
                    `https://www.${variant.replace(/\s+/g, '')}.com`,
                    `https://${variant.replace(/\s+/g, '')}.com`,
                    `https://www.${variant.replace(/\s+/g, '-')}.com`
                ];
                
                for (const url of urls) {
                    if (await this.verifyWebsite(url)) {
                        return url;
                    }
                }
            }
        }
        
        return null;
    }

    async verifyWebsite(url) {
        try {
            // Quick verification with HEAD request
            const response = await axios.head(url, {
                timeout: 3000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 3,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Accept redirects
                }
            });
            
            return response.status < 400;
        } catch (error) {
            // Try GET as fallback (some sites block HEAD)
            try {
                const response = await axios.get(url, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    maxRedirects: 3,
                    validateStatus: function (status) {
                        return status >= 200 && status < 400;
                    }
                });
                
                return response.status < 400;
            } catch {
                return false;
            }
        }
    }

    cleanCompanyName(name) {
        return name
            .toLowerCase()
            .replace(/\s*(inc|corp|ltd|limited|llc|gmbh|sa|sas|sarl|plc|ag|bv|nv|pty|pvt)\.?\s*$/i, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim();
    }

    cleanWebsiteUrl(url) {
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        // Remove trailing slashes
        url = url.replace(/\/+$/, '');
        
        // Convert to lowercase for domain
        try {
            const urlObj = new URL(url);
            urlObj.hostname = urlObj.hostname.toLowerCase();
            return urlObj.toString();
        } catch {
            return url.toLowerCase();
        }
    }

    isValidWebsiteUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        // Check if it's a placeholder
        if (this.isPlaceholder(url)) return false;
        
        // Basic URL validation
        try {
            const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
            
            // Check if it has a valid domain
            if (!urlObj.hostname || urlObj.hostname.length < 3) return false;
            
            // Check if it's not a social media or directory site
            const invalidDomains = [
                'linkedin.com',
                'facebook.com',
                'twitter.com',
                'instagram.com',
                'youtube.com',
                'wikipedia.org',
                'bloomberg.com',
                'crunchbase.com'
            ];
            
            if (invalidDomains.some(domain => urlObj.hostname.includes(domain))) {
                return false;
            }
            
            return true;
        } catch {
            return false;
        }
    }

    isPlaceholder(value) {
        if (!value || typeof value !== 'string') return true;
        
        const placeholders = [
            'not provided',
            'n/a',
            'na',
            'none',
            'null',
            'undefined',
            '-',
            'tbd',
            'coming soon',
            'not available',
            'pending',
            'unknown'
        ];
        
        return placeholders.includes(value.toLowerCase().trim());
    }

    generateSummary() {
        const totalProcessed = this.results.processed + this.results.alreadyHadWebsite;
        const totalWithWebsite = this.results.found + this.results.alreadyHadWebsite;
        const findRate = this.results.processed > 0 
            ? ((this.results.found / this.results.processed) * 100).toFixed(1)
            : 0;
        
        console.log(`\n   📊 Website Finding Summary:`);
        console.log(`      Total companies: ${totalProcessed}`);
        console.log(`      Already had website: ${this.results.alreadyHadWebsite}`);
        console.log(`      Found: ${this.results.found} (${findRate}% of those needing it)`);
        console.log(`      Found via search: ${this.results.foundViaSearch}`);
        console.log(`      Found via pattern: ${this.results.foundViaPattern}`);
        console.log(`      Verified: ${this.results.verified}`);
        console.log(`      Not found: ${this.results.notFound}`);
        console.log(`      Total with website now: ${totalWithWebsite}`);
        
        return {
            results: [],
            summary: {
                processed: totalProcessed,
                successful: this.results.found,
                successRate: findRate,
                qualifiedCount: totalWithWebsite,
                errorCount: this.results.errors.length,
                details: {
                    alreadyHadWebsite: this.results.alreadyHadWebsite,
                    foundViaSearch: this.results.foundViaSearch,
                    foundViaPattern: this.results.foundViaPattern,
                    verified: this.results.verified,
                    notFound: this.results.notFound
                }
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = WebsiteFinder;