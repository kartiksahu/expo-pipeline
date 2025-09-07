/**
 * LinkedIn Enhancement Module
 * Finds LinkedIn URLs for companies using website extraction and web search fallback
 * Based on proven methodologies from BigData Paris and CMTS projects
 */

const axios = require('axios');
const cheerio = require('cheerio');

class LinkedInEnhancer {
    constructor(stageConfig, apiSettings) {
        this.config = stageConfig;
        this.api = apiSettings;
        this.results = {
            processed: 0,
            enhanced: 0,
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
        
        // Step 1: Consolidate all LinkedIn columns into linkedin_url field
        console.log(`   🔄 Consolidating LinkedIn columns...`);
        let validExisting = 0;
        let invalidExisting = 0;
        
        for (const company of companies) {
            // Check all possible LinkedIn column names
            const possibleLinkedIn = 
                company.linkedin_url || 
                company.linkedin || 
                company.LinkedIn || 
                company['LinkedIn URL'] || 
                company['LinkedIn url'] || 
                company['linkedin_url'] || 
                '';
            
            // Validate if it's a real LinkedIn company URL
            if (this.isValidLinkedInUrl(possibleLinkedIn)) {
                company.linkedin_url = this.cleanLinkedInUrl(possibleLinkedIn);
                company.linkedin_source = 'existing_valid';
                company.linkedin_original = possibleLinkedIn; // Keep original for reference
                validExisting++;
            } else if (possibleLinkedIn && !this.isPlaceholder(possibleLinkedIn)) {
                // Has something but it's not valid - needs verification
                console.log(`   ⚠️  Invalid LinkedIn URL for ${company.name}: ${possibleLinkedIn}`);
                company.linkedin_url = '';
                company.linkedin_source = 'invalid_existing';
                company.linkedin_original = possibleLinkedIn;
                invalidExisting++;
            } else {
                // Empty or placeholder
                company.linkedin_url = '';
                company.linkedin_source = '';
                company.linkedin_original = '';
            }
        }
        
        console.log(`   ✅ Found ${validExisting} valid existing LinkedIn URLs`);
        if (invalidExisting > 0) {
            console.log(`   ⚠️  Found ${invalidExisting} invalid LinkedIn URLs that need replacement`);
        }
        
        this.results.alreadyHadLinkedIn = validExisting;
        
        // Step 2: Filter to companies that need LinkedIn enhancement
        const actualNeedsLinkedIn = companies.filter(c => !c.linkedin_url || c.linkedin_url.trim() === '');
        
        if (actualNeedsLinkedIn.length === 0) {
            console.log(`   ✅ All companies already have LinkedIn URLs`);
            return this.generateSummary();
        }
        
        console.log(`   🔍 ${actualNeedsLinkedIn.length} companies need LinkedIn URLs (rechecked)`);
        console.log(`   ⏩ ${companies.length - actualNeedsLinkedIn.length} companies already have LinkedIn`);

        // Process companies that need LinkedIn
        for (let i = 0; i < actualNeedsLinkedIn.length; i++) {
            const company = actualNeedsLinkedIn[i];
            console.log(`   [${i + 1}/${actualNeedsLinkedIn.length}] ${company.name || company.companyName}`);
            
            try {
                // Try to find LinkedIn URL
                const linkedinUrl = await this.findLinkedInUrl(company);
                
                if (linkedinUrl) {
                    company.linkedin_url = linkedinUrl.url;
                    company.linkedin_source = linkedinUrl.source;
                    this.results.enhanced++;
                    
                    if (linkedinUrl.source === 'website') {
                        this.results.foundViaWebsite++;
                        console.log(`     ✅ Found via website: ${linkedinUrl.url}`);
                    } else if (linkedinUrl.source === 'web_search') {
                        this.results.foundViaWebSearch++;
                        console.log(`     ✅ Found via web search: ${linkedinUrl.url}`);
                    } else if (linkedinUrl.source === 'pattern_match') {
                        this.results.foundViaPattern++;
                        console.log(`     ✅ Found via pattern matching: ${linkedinUrl.url}`);
                    }
                } else {
                    company.linkedin_url = company.linkedin_url || '';
                    company.linkedin_source = 'not_found';
                    this.results.notFound++;
                    console.log(`     ❌ LinkedIn not found`);
                }
                
                this.results.processed++;
                
                // Rate limiting
                if (i < actualNeedsLinkedIn.length - 1) {
                    await this.delay(1000); // 1 second delay between companies
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
        // Step 1: Try to find LinkedIn from website
        if (company.website && company.website.trim() !== '') {
            console.log(`     🌐 Checking website for LinkedIn...`);
            const linkedinFromWebsite = await this.extractLinkedInFromWebsite(company.website);
            if (linkedinFromWebsite) {
                return { url: linkedinFromWebsite, source: 'website' };
            }
        }
        
        // Step 2: Try real web search (Google/DuckDuckGo simulation)
        if (this.config.web_search_fallback) {
            console.log(`     🔍 Performing web search...`);
            const linkedinFromWebSearch = await this.performWebSearch(company);
            if (linkedinFromWebSearch) {
                return { url: linkedinFromWebSearch, source: 'web_search' };
            }
            
            // Step 3: Fallback to pattern matching as last resort
            console.log(`     🎯 Trying pattern matching...`);
            const linkedinFromPattern = await this.searchForLinkedIn(company);
            if (linkedinFromPattern) {
                return { url: linkedinFromPattern, source: 'pattern_match' };
            }
        }
        
        return null;
    }

    async extractLinkedInFromWebsite(websiteUrl) {
        try {
            // Ensure URL has protocol
            if (!websiteUrl.startsWith('http')) {
                websiteUrl = 'https://' + websiteUrl;
            }
            
            // Fetch website HTML
            const response = await axios.get(websiteUrl, {
                timeout: this.config.timeout_ms || 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 5
            });
            
            const $ = cheerio.load(response.data);
            
            // Look for LinkedIn company links
            const linkedinLinks = [];
            
            // Direct LinkedIn company links
            $('a[href*="linkedin.com/company"]').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href && !this.isPersonalLinkedIn(href)) {
                    linkedinLinks.push(this.cleanLinkedInUrl(href));
                }
            });
            
            // LinkedIn links in social media sections
            $('.social a[href*="linkedin"], .social-links a[href*="linkedin"], [class*="social"] a[href*="linkedin"]').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href && href.includes('linkedin.com') && !this.isPersonalLinkedIn(href)) {
                    linkedinLinks.push(this.cleanLinkedInUrl(href));
                }
            });
            
            // LinkedIn icon links
            $('a i[class*="linkedin"], a svg[class*="linkedin"], a img[alt*="linkedin"]').each((i, elem) => {
                const link = $(elem).closest('a');
                const href = link.attr('href');
                if (href && href.includes('linkedin.com') && !this.isPersonalLinkedIn(href)) {
                    linkedinLinks.push(this.cleanLinkedInUrl(href));
                }
            });
            
            // Return first valid LinkedIn company URL found
            return linkedinLinks.length > 0 ? linkedinLinks[0] : null;
            
        } catch (error) {
            // Website fetch failed, return null
            return null;
        }
    }

    async performWebSearch(company) {
        // Real web search using multiple search query strategies
        const companyName = company.name || company.companyName || '';
        const cleanName = companyName.replace(/\s*(inc|corp|ltd|limited|llc|gmbh|sa|sas|sarl)\.?\s*$/i, '').trim();
        
        // Try multiple search queries to find LinkedIn
        const searchQueries = [
            `${cleanName} LinkedIn company page`,
            `"${cleanName}" site:linkedin.com/company`,
            `${cleanName} official LinkedIn profile`
        ];
        
        // NO SIMULATIONS - Return null since we don't have real web search here
        console.log('       ⚠️ Web search not available in this module - returning null');
        return null;
    }
    
    // DEPRECATED - This method should not be used
    async simulateWebSearchResult_DEPRECATED(query, companyName) {
        // This simulates what a web search would return
        // Common LinkedIn URL patterns based on company names
        const cleanName = companyName.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim();
        
        // Common transformations that search engines would find
        const variations = [
            cleanName.replace(/\s+/g, '-'),
            cleanName.replace(/\s+/g, ''),
            cleanName.replace(/\s+/g, '-').replace(/-+/g, '-'),
            // Handle common abbreviations
            cleanName.split(' ').map(w => w[0]).join('').toLowerCase(),
            // Handle "The" prefix
            cleanName.replace(/^the\s+/i, '').replace(/\s+/g, '-')
        ];
        
        // Try each variation
        for (const variant of variations) {
            if (variant.length > 2) {
                const url = `https://www.linkedin.com/company/${variant}`;
                if (await this.verifyLinkedInUrl(url)) {
                    return url;
                }
            }
        }
        
        return null;
    }
    
    async verifyLinkedInUrl(url) {
        try {
            const response = await axios.head(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 2
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    async searchForLinkedIn(company) {
        // Pattern matching as final fallback
        const companyName = (company.name || company.companyName || '').toLowerCase();
        const cleanName = companyName
            .replace(/\s*(inc|corp|ltd|limited|llc|gmbh|sa|sas|sarl)\.?\s*$/i, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');
        
        if (cleanName.length > 2) {
            try {
                // Try common LinkedIn company URL pattern and verify it exists
                const possibleUrl = `https://www.linkedin.com/company/${cleanName}`;
                
                // Verify the URL exists by making a HEAD request
                const response = await axios.head(possibleUrl, {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.status === 200) {
                    return possibleUrl;
                }
            } catch (error) {
                // URL doesn't exist or failed to verify
            }
            
            // Try alternative patterns
            const alternatives = [
                `https://www.linkedin.com/company/${cleanName.replace(/-/g, '')}`,
                `https://www.linkedin.com/company/${companyName.replace(/\s+/g, '-').toLowerCase()}`,
                `https://www.linkedin.com/company/${companyName.replace(/\s+/g, '').toLowerCase()}`
            ];
            
            for (const altUrl of alternatives) {
                try {
                    const response = await axios.head(altUrl, {
                        timeout: 5000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (response.status === 200) {
                        return altUrl;
                    }
                } catch (error) {
                    // Continue to next alternative
                }
            }
        }
        
        return null;
    }

    isValidLinkedInUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        // Check if it's a placeholder
        if (this.isPlaceholder(url)) return false;
        
        // Check if it contains linkedin.com
        if (!url.toLowerCase().includes('linkedin.com')) return false;
        
        // Check if it's a company page (not personal)
        if (this.isPersonalLinkedIn(url)) return false;
        
        // Check if it has /company/ in the path
        if (!url.includes('/company/')) return false;
        
        return true;
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
            'not available'
        ];
        
        return placeholders.includes(value.toLowerCase().trim());
    }
    
    isPersonalLinkedIn(url) {
        return url.includes('/in/') || url.includes('/profile/');
    }

    cleanLinkedInUrl(url) {
        // Remove tracking parameters and clean the URL
        try {
            const urlObj = new URL(url);
            return `https://www.linkedin.com${urlObj.pathname}`;
        } catch {
            return url;
        }
    }

    generateSummary() {
        const totalProcessed = this.results.processed + this.results.alreadyHadLinkedIn;
        const totalWithLinkedIn = this.results.enhanced + this.results.alreadyHadLinkedIn;
        const enhancementRate = this.results.processed > 0 
            ? ((this.results.enhanced / this.results.processed) * 100).toFixed(1)
            : 0;
        
        console.log(`\n   📊 LinkedIn Enhancement Summary:`);
        console.log(`      Total companies: ${totalProcessed}`);
        console.log(`      Valid existing LinkedIn: ${this.results.alreadyHadLinkedIn}`);
        console.log(`      Enhanced: ${this.results.enhanced} (${enhancementRate}% of those needing it)`);
        console.log(`      Found via website: ${this.results.foundViaWebsite}`);
        console.log(`      Found via web search: ${this.results.foundViaWebSearch}`);
        console.log(`      Found via pattern: ${this.results.foundViaPattern}`);
        console.log(`      Not found: ${this.results.notFound}`);
        console.log(`      Total with LinkedIn now: ${totalWithLinkedIn}`);
        
        return {
            results: [],
            summary: {
                processed: totalProcessed,
                successful: this.results.enhanced,
                successRate: enhancementRate,
                qualifiedCount: totalWithLinkedIn,
                errorCount: this.results.errors.length,
                details: {
                    validExistingLinkedIn: this.results.alreadyHadLinkedIn,
                    foundViaWebsite: this.results.foundViaWebsite,
                    foundViaWebSearch: this.results.foundViaWebSearch,
                    foundViaPattern: this.results.foundViaPattern,
                    notFound: this.results.notFound
                }
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = LinkedInEnhancer;