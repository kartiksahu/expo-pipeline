/**
 * LinkedIn Enhancer with REAL Web Search
 * NO SIMULATIONS - Uses real web search via WebSearchReal module
 */

const axios = require('axios');
const cheerio = require('cheerio');
const UniversalWebSearch = require('./web-search-universal');

class LinkedInEnhancerReal {
    constructor(stageConfig, apiSettings) {
        this.config = {
            web_search_fallback: true,
            timeout_ms: 10000,
            max_search_attempts: 2,
            ...stageConfig
        };
        this.api = apiSettings;
        
        // Initialize REAL web search (no Playwright dependency)
        this.webSearch = new UniversalWebSearch({
            timeout: 15000,
            waitTime: 3000
        });
        
        this.results = {
            processed: 0,
            successful: 0,
            alreadyHadLinkedIn: 0,
            foundViaWebsite: 0,
            foundViaWebSearch: 0,
            foundViaPattern: 0,
            notFound: 0,
            errors: []
        };
    }

    async process(companies) {
        console.log(`   📊 Enhancing LinkedIn URLs for ${companies.length} companies...`);
        
        // Step 1: Consolidate LinkedIn columns
        console.log(`   🔄 Consolidating LinkedIn columns...`);
        let validExisting = 0;
        let invalidExisting = 0;
        
        for (const company of companies) {
            // Check all possible LinkedIn column names
            const possibleLinkedIn = 
                company.linkedin || 
                company.LinkedIn || 
                company['LinkedIn URL'] || 
                company['linkedin_url'] || 
                company['LinkedIn url'] || 
                '';
            
            // Validate if it's a real LinkedIn URL
            if (this.isValidLinkedInUrl(possibleLinkedIn)) {
                company.linkedin_url = this.cleanLinkedInUrl(possibleLinkedIn);
                company.linkedin_source = 'existing';
                validExisting++;
            } else if (possibleLinkedIn && !this.isPlaceholder(possibleLinkedIn)) {
                // Has something but it's not valid
                console.log(`   ⚠️  Invalid LinkedIn URL for ${company.name}: ${possibleLinkedIn}`);
                company.linkedin_url = '';
                company.linkedin_source = 'invalid_existing';
                invalidExisting++;
            } else {
                // Empty or placeholder
                company.linkedin_url = '';
                company.linkedin_source = '';
            }
        }
        
        console.log(`   ✅ Found ${validExisting} valid existing LinkedIn URLs`);
        if (invalidExisting > 0) {
            console.log(`   ⚠️  Found ${invalidExisting} invalid LinkedIn URLs that need replacement`);
        }
        
        this.results.alreadyHadLinkedIn = validExisting;
        
        // Step 2: Find LinkedIn URLs for companies that don't have them
        const needsLinkedIn = companies.filter(c => !c.linkedin_url || c.linkedin_url.trim() === '');
        
        if (needsLinkedIn.length === 0) {
            console.log(`   ✅ All companies already have LinkedIn URLs`);
            return this.generateSummary();
        }
        
        console.log(`   🔍 ${needsLinkedIn.length} companies need LinkedIn URLs`);
        
        // Process companies that need LinkedIn
        for (let i = 0; i < needsLinkedIn.length; i++) {
            const company = needsLinkedIn[i];
            console.log(`   [${i + 1}/${needsLinkedIn.length}] ${company.name || company.companyName}`);
            
            try {
                // Try to find LinkedIn URL
                const linkedinResult = await this.findLinkedInUrl(company);
                
                if (linkedinResult) {
                    company.linkedin_url = linkedinResult.url;
                    company.linkedin_source = linkedinResult.source;
                    this.results.successful++;
                    
                    if (linkedinResult.source === 'website') {
                        this.results.foundViaWebsite++;
                        console.log(`     ✅ Found via website scraping: ${linkedinResult.url}`);
                    } else if (linkedinResult.source === 'web_search') {
                        this.results.foundViaWebSearch++;
                        console.log(`     ✅ Found via universal web search: ${linkedinResult.url}`);
                    } else if (linkedinResult.source === 'pattern') {
                        this.results.foundViaPattern++;
                        console.log(`     ✅ Found via pattern matching: ${linkedinResult.url}`);
                    }
                } else {
                    company.linkedin_url = '';
                    company.linkedin_source = 'not_found';
                    this.results.notFound++;
                    console.log(`     ❌ LinkedIn URL not found`);
                }
                
                this.results.processed++;
                
                // Rate limiting
                if (i < needsLinkedIn.length - 1) {
                    await this.delay(this.api.rate_limit_ms || 1000);
                }
                
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
                company.linkedin_url = '';
                company.linkedin_source = 'error';
                this.results.errors.push({ company: company.name, error: error.message });
                this.results.processed++;
            }
        }
        
        return this.generateSummary();
    }

    async findLinkedInUrl(company) {
        const companyName = company.name || company.companyName || '';
        
        // Strategy 1: Scrape company website for LinkedIn links
        if (company.website) {
            console.log(`     🌐 Checking website: ${company.website}`);
            const linkedinFromWebsite = await this.scrapeWebsiteForLinkedIn(company.website);
            if (linkedinFromWebsite) {
                return { url: linkedinFromWebsite, source: 'website' };
            }
        }
        
        // Strategy 2: Universal web search (NO Playwright dependency)
        if (this.config.web_search_fallback) {
            console.log(`     🔍 Trying universal web search...`);
            const linkedinFromSearch = await this.webSearch.searchForLinkedIn(companyName);
            if (linkedinFromSearch) {
                // Verify the URL is valid
                if (await this.verifyLinkedInUrl(linkedinFromSearch)) {
                    return { url: linkedinFromSearch, source: 'web_search' };
                }
            }
        }
        
        // Strategy 3: Try common LinkedIn patterns (last resort)
        console.log(`     🎯 Trying LinkedIn patterns...`);
        const linkedinFromPattern = await this.tryLinkedInPatterns(companyName);
        if (linkedinFromPattern) {
            return { url: linkedinFromPattern, source: 'pattern' };
        }
        
        return null;
    }

    async scrapeWebsiteForLinkedIn(website) {
        try {
            const response = await axios.get(website, {
                timeout: this.config.timeout_ms,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const $ = cheerio.load(response.data);
            const linkedinLinks = [];
            
            // Look for LinkedIn links
            $('a[href*="linkedin.com"]').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href && href.includes('linkedin.com/company')) {
                    linkedinLinks.push(this.cleanLinkedInUrl(href));
                }
            });
            
            // LinkedIn icon links
            $('a i[class*="linkedin"], a svg[class*="linkedin"], a img[alt*="linkedin"]').each((i, elem) => {
                const link = $(elem).closest('a');
                const href = link.attr('href');
                if (href && href.includes('linkedin.com') && href.includes('/company/')) {
                    linkedinLinks.push(this.cleanLinkedInUrl(href));
                }
            });
            
            // Return first valid LinkedIn company URL found
            return linkedinLinks.length > 0 ? linkedinLinks[0] : null;
            
        } catch (error) {
            return null;
        }
    }

    async tryLinkedInPatterns(companyName) {
        const cleanName = companyName.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        
        // Only try the most common pattern
        const url = `https://www.linkedin.com/company/${cleanName}`;
        
        if (await this.verifyLinkedInUrl(url)) {
            return url;
        }
        
        return null;
    }

    async verifyLinkedInUrl(url) {
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return response.status < 400;
        } catch (error) {
            return false;
        }
    }

    isValidLinkedInUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (this.isPlaceholder(url)) return false;
        return url.includes('linkedin.com/company/');
    }

    isPlaceholder(value) {
        if (!value || typeof value !== 'string') return true;
        
        const placeholders = [
            'not provided', 'n/a', 'na', 'none', 'null', 'undefined',
            '-', 'tbd', 'coming soon', 'not available', 'pending', 'unknown'
        ];
        
        return placeholders.includes(value.toLowerCase().trim());
    }

    cleanLinkedInUrl(url) {
        // Remove tracking parameters and ensure proper format
        if (!url) return '';
        
        const urlParts = url.split('?')[0];
        
        // Ensure it starts with https
        if (!urlParts.startsWith('http')) {
            return 'https://www.linkedin.com' + urlParts;
        }
        
        return urlParts;
    }

    generateSummary() {
        const totalProcessed = this.results.processed + this.results.alreadyHadLinkedIn;
        const totalWithLinkedIn = this.results.successful + this.results.alreadyHadLinkedIn;
        const findRate = this.results.processed > 0 
            ? ((this.results.successful / this.results.processed) * 100).toFixed(1)
            : 0;
        
        console.log(`\n   📊 LinkedIn Enhancement Summary:`);
        console.log(`      Total companies: ${totalProcessed}`);
        console.log(`      Valid existing LinkedIn: ${this.results.alreadyHadLinkedIn}`);
        console.log(`      Enhanced: ${this.results.successful} (${findRate}% of those needing it)`);
        console.log(`      Found via website: ${this.results.foundViaWebsite}`);
        console.log(`      Found via universal web search: ${this.results.foundViaWebSearch}`);
        console.log(`      Found via pattern: ${this.results.foundViaPattern}`);
        console.log(`      Not found: ${this.results.notFound}`);
        console.log(`      Total with LinkedIn now: ${totalWithLinkedIn}`);
        
        return {
            results: [],
            summary: {
                processed: totalProcessed,
                successful: this.results.successful,
                successRate: findRate,
                qualifiedCount: totalWithLinkedIn,
                errorCount: this.results.errors.length
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = LinkedInEnhancerReal;