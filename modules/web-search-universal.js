/**
 * Universal Web Search Module
 * Uses standard HTTP libraries (no Playwright dependency)
 * Performs real web searches using DuckDuckGo HTML scraping
 */

const axios = require('axios');
const cheerio = require('cheerio');

class UniversalWebSearch {
    constructor(config = {}) {
        this.config = {
            timeout: 15000,
            waitTime: 2000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            maxRetries: 2,
            ...config
        };
    }

    /**
     * Search for LinkedIn company URLs using DuckDuckGo
     */
    async searchForLinkedIn(companyName) {
        console.log(`       🔍 Universal web search for LinkedIn: ${companyName}`);
        
        try {
            // DuckDuckGo search for company LinkedIn
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(companyName)}+site:linkedin.com/company`;
            
            const response = await axios.get(searchUrl, {
                timeout: this.config.timeout,
                headers: {
                    'User-Agent': this.config.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'DNT': '1',
                    'Connection': 'keep-alive'
                }
            });

            if (response.data) {
                const linkedinUrls = this.extractLinkedInUrls(response.data);
                if (linkedinUrls.length > 0) {
                    console.log(`       ✅ Found ${linkedinUrls.length} LinkedIn URLs via universal search`);
                    return linkedinUrls[0]; // Return first valid LinkedIn URL
                }
            }
            
            console.log(`       ❌ No LinkedIn URLs found in search results`);
            return null;
            
        } catch (error) {
            console.log(`       ❌ Universal web search failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Search for company websites using DuckDuckGo
     */
    async searchForWebsite(companyName) {
        console.log(`       🔍 Universal web search for website: ${companyName}`);
        
        try {
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(companyName)}+official+website`;
            
            const response = await axios.get(searchUrl, {
                timeout: this.config.timeout,
                headers: {
                    'User-Agent': this.config.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });

            if (response.data) {
                const websiteUrls = this.extractWebsiteUrls(response.data, companyName);
                if (websiteUrls.length > 0) {
                    console.log(`       ✅ Found ${websiteUrls.length} potential websites via universal search`);
                    return websiteUrls[0];
                }
            }
            
            console.log(`       ❌ No website URLs found in search results`);
            return null;
            
        } catch (error) {
            console.log(`       ❌ Universal web search failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Search for job openings using DuckDuckGo
     */
    async searchJobOpenings(companyName) {
        const results = {
            found: false,
            sources: [],
            jobTitles: [],
            hasSales: false,
            hasMarketing: false,
            hasBD: false,
            searchUrls: []
        };

        try {
            console.log(`       🔍 Universal job search for: ${companyName}`);
            
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(companyName)}+hiring+jobs+careers`;
            results.searchUrls.push(searchUrl);

            const response = await axios.get(searchUrl, {
                timeout: this.config.timeout,
                headers: { 'User-Agent': this.config.userAgent }
            });

            if (response.data) {
                const jobData = this.extractJobDataFromSearch(response.data, companyName);
                if (jobData.found) {
                    results.found = true;
                    results.sources.push('duckduckgo_search');
                    results.jobTitles.push(...jobData.titles);
                    results.hasSales = jobData.hasSales;
                    results.hasMarketing = jobData.hasMarketing;
                    results.hasBD = jobData.hasBD;
                    console.log(`       ✅ Found job data via universal search`);
                }
            }

        } catch (error) {
            console.log(`       ⚠️ Universal job search failed: ${error.message}`);
        }

        return results;
    }

    /**
     * Search for funding announcements using DuckDuckGo
     */
    async searchFundingAnnouncements(companyName) {
        const results = {
            found: false,
            sources: [],
            fundingRounds: [],
            searchUrls: []
        };

        try {
            console.log(`       💰 Universal funding search for: ${companyName}`);
            
            const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(companyName)}+funding+raised+investment+series`;
            results.searchUrls.push(searchUrl);

            const response = await axios.get(searchUrl, {
                timeout: this.config.timeout,
                headers: { 'User-Agent': this.config.userAgent }
            });

            if (response.data) {
                const fundingData = this.extractFundingDataFromSearch(response.data, companyName);
                if (fundingData.found) {
                    results.found = true;
                    results.sources.push('duckduckgo_search');
                    results.fundingRounds.push(...fundingData.rounds);
                    console.log(`       ✅ Found funding data via universal search`);
                }
            }

        } catch (error) {
            console.log(`       ⚠️ Universal funding search failed: ${error.message}`);
        }

        return results;
    }

    /**
     * Extract LinkedIn company URLs from HTML
     */
    extractLinkedInUrls(html) {
        const urls = [];
        const $ = cheerio.load(html);
        
        // Find links in search results
        $('a[href*="linkedin.com/company"]').each((i, elem) => {
            const url = $(elem).attr('href');
            if (url && this.isValidLinkedInUrl(url)) {
                const cleanUrl = this.cleanUrl(url);
                if (!urls.includes(cleanUrl)) {
                    urls.push(cleanUrl);
                }
            }
        });

        // Also check for URLs in text content
        const urlRegex = /https?:\/\/[^\s]*linkedin\.com\/company\/[a-zA-Z0-9-]+/g;
        const textMatches = html.match(urlRegex) || [];
        textMatches.forEach(url => {
            if (this.isValidLinkedInUrl(url)) {
                const cleanUrl = this.cleanUrl(url);
                if (!urls.includes(cleanUrl)) {
                    urls.push(cleanUrl);
                }
            }
        });
        
        return urls;
    }

    /**
     * Extract potential company website URLs from search results
     */
    extractWebsiteUrls(html, companyName) {
        const urls = [];
        const $ = cheerio.load(html);
        const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Find external links in search results
        $('a[href^="http"]').each((i, elem) => {
            const url = $(elem).attr('href');
            if (url && this.isValidWebsiteUrl(url, cleanName)) {
                urls.push(url);
            }
        });

        // Extract URLs from text content
        const urlRegex = /https?:\/\/[^\s<>"]+\.[a-zA-Z]{2,}/g;
        const textMatches = html.match(urlRegex) || [];
        textMatches.forEach(url => {
            if (this.isValidWebsiteUrl(url, cleanName)) {
                urls.push(url);
            }
        });
        
        return [...new Set(urls)]; // Remove duplicates
    }

    /**
     * Extract job-related information from search results
     */
    extractJobDataFromSearch(html, companyName) {
        const results = {
            found: false,
            titles: [],
            hasSales: false,
            hasMarketing: false,
            hasBD: false
        };

        try {
            const lowerHtml = html.toLowerCase();
            const companyLower = companyName.toLowerCase();

            // Look for hiring indicators
            const hiringIndicators = [
                'hiring', 'jobs', 'careers', 'join', 'work with us', 'we are looking',
                'open positions', 'now hiring', 'job openings', 'employment'
            ];

            const hasHiringContent = hiringIndicators.some(indicator => 
                lowerHtml.includes(indicator) && lowerHtml.includes(companyLower)
            );

            if (hasHiringContent) {
                results.found = true;
                
                // Check for specific role types
                const salesPatterns = ['sales', 'account manager', 'business development', 'commercial', 'revenue'];
                const marketingPatterns = ['marketing', 'growth', 'brand', 'digital marketing', 'demand generation'];
                const bdPatterns = ['business development', 'partnership', 'alliance', 'biz dev'];

                results.hasSales = salesPatterns.some(pattern => lowerHtml.includes(pattern));
                results.hasMarketing = marketingPatterns.some(pattern => lowerHtml.includes(pattern));
                results.hasBD = bdPatterns.some(pattern => lowerHtml.includes(pattern));
            }

        } catch (error) {
            console.log(`       ⚠️ Job data extraction failed: ${error.message}`);
        }

        return results;
    }

    /**
     * Extract funding information from search results
     */
    extractFundingDataFromSearch(html, companyName) {
        const results = {
            found: false,
            rounds: []
        };

        try {
            const lowerHtml = html.toLowerCase();
            const companyLower = companyName.toLowerCase();

            // Look for funding indicators
            const fundingIndicators = [
                'raised', 'funding', 'investment', 'million', 'series', 'seed',
                'venture capital', 'announces', 'closes', 'secures'
            ];

            const hasFundingContent = fundingIndicators.some(indicator => 
                lowerHtml.includes(indicator) && lowerHtml.includes(companyLower)
            );

            if (hasFundingContent) {
                results.found = true;

                // Extract funding amounts
                const amountPatterns = [
                    /\$[\d,.]+ ?(million|billion|m|b)/gi,
                    /€[\d,.]+ ?(million|billion|m|b)/gi
                ];

                amountPatterns.forEach(pattern => {
                    const matches = html.match(pattern);
                    if (matches) {
                        matches.slice(0, 2).forEach(match => {
                            results.rounds.push({
                                amount: match,
                                type: 'funding',
                                date: new Date().toISOString().split('T')[0],
                                raw: `Found via search: ${match}`,
                                source: 'universal_search'
                            });
                        });
                    }
                });
            }

        } catch (error) {
            console.log(`       ⚠️ Funding data extraction failed: ${error.message}`);
        }

        return results;
    }

    /**
     * Validate LinkedIn URL
     */
    isValidLinkedInUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return url.includes('linkedin.com/company/') && 
               !url.includes('linkedin.com/in/') &&
               !url.includes('/posts/');
    }

    /**
     * Validate website URL for company
     */
    isValidWebsiteUrl(url, cleanCompanyName) {
        if (!url || typeof url !== 'string') return false;
        
        // Skip social media and known non-company sites
        const skipDomains = [
            'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com',
            'youtube.com', 'wikipedia.org', 'duckduckgo.com', 'google.com',
            'bing.com', 'yahoo.com', 'reddit.com', 'github.com'
        ];
        
        const isSkipped = skipDomains.some(domain => url.includes(domain));
        if (isSkipped) return false;

        // Check if URL might be related to company name
        const urlLower = url.toLowerCase();
        return urlLower.includes(cleanCompanyName.substring(0, Math.min(5, cleanCompanyName.length)));
    }

    /**
     * Clean URL by removing tracking parameters
     */
    cleanUrl(url) {
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        } catch {
            return url.split('?')[0];
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = UniversalWebSearch;