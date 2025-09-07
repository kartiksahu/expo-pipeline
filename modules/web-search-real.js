/**
 * Real Web Search Module
 * Uses Playwright MCP for actual web searches
 * NO SIMULATIONS - Returns empty if Playwright not available
 */

class WebSearchReal {
    constructor(config = {}) {
        this.config = {
            timeout: 15000,
            waitTime: 3000,
            ...config
        };
    }

    /**
     * Perform real web search for LinkedIn URLs
     * Returns empty if Playwright not available
     */
    async searchForLinkedIn(companyName) {
        console.log(`       🔍 Attempting real web search for LinkedIn: ${companyName}`);
        
        // Check if Playwright MCP is available
        if (typeof mcp__playwright__playwright_navigate !== 'function') {
            console.log(`       ⚠️ Playwright not available - no web search performed`);
            return null; // Return null, don't simulate!
        }

        try {
            const searchUrl = `https://duckduckgo.com/?q="${companyName}"+site:linkedin.com/company`;
            console.log(`       🌐 Real search URL: ${searchUrl}`);
            
            await mcp__playwright__playwright_navigate({ url: searchUrl });
            await this.delay(this.config.waitTime);
            
            // Get real search results HTML
            const searchHtml = await mcp__playwright__playwright_get_visible_html({ 
                removeScripts: true,
                maxLength: 10000
            });
            
            if (searchHtml) {
                // Extract LinkedIn URLs from real search results
                const linkedinUrls = this.extractLinkedInUrls(searchHtml);
                if (linkedinUrls.length > 0) {
                    console.log(`       ✅ Found ${linkedinUrls.length} LinkedIn URLs in search results`);
                    return linkedinUrls[0]; // Return first valid LinkedIn URL
                }
            }
            
            console.log(`       ❌ No LinkedIn URLs found in search results`);
            return null;
            
        } catch (error) {
            console.log(`       ❌ Web search failed: ${error.message}`);
            return null; // Return null on error, don't simulate!
        }
    }

    /**
     * Extract LinkedIn company URLs from search results HTML
     */
    extractLinkedInUrls(html) {
        const urls = [];
        
        // Match LinkedIn company URLs in the HTML
        const regex = /https?:\/\/(www\.)?linkedin\.com\/company\/[a-zA-Z0-9-]+/g;
        const matches = html.match(regex);
        
        if (matches) {
            // Clean and deduplicate URLs
            const uniqueUrls = [...new Set(matches)];
            uniqueUrls.forEach(url => {
                // Clean URL (remove tracking parameters)
                const cleanUrl = url.split('?')[0];
                if (!urls.includes(cleanUrl)) {
                    urls.push(cleanUrl);
                }
            });
        }
        
        return urls;
    }

    /**
     * Perform real web search for company websites
     * Returns empty if Playwright not available
     */
    async searchForWebsite(companyName) {
        console.log(`       🔍 Attempting real web search for website: ${companyName}`);
        
        if (typeof mcp__playwright__playwright_navigate !== 'function') {
            console.log(`       ⚠️ Playwright not available - no web search performed`);
            return null;
        }

        try {
            const searchUrl = `https://duckduckgo.com/?q="${companyName}"+official+website`;
            console.log(`       🌐 Real search URL: ${searchUrl}`);
            
            await mcp__playwright__playwright_navigate({ url: searchUrl });
            await this.delay(this.config.waitTime);
            
            const searchHtml = await mcp__playwright__playwright_get_visible_html({ 
                removeScripts: true,
                maxLength: 10000
            });
            
            if (searchHtml) {
                // Extract website URLs from real search results
                const websiteUrls = this.extractWebsiteUrls(searchHtml, companyName);
                if (websiteUrls.length > 0) {
                    console.log(`       ✅ Found ${websiteUrls.length} potential websites`);
                    return websiteUrls[0];
                }
            }
            
            console.log(`       ❌ No website URLs found in search results`);
            return null;
            
        } catch (error) {
            console.log(`       ❌ Web search failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract potential company website URLs from search results
     */
    extractWebsiteUrls(html, companyName) {
        const urls = [];
        const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Match URLs that might be company websites
        const regex = /https?:\/\/(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g;
        const matches = html.match(regex);
        
        if (matches) {
            matches.forEach(url => {
                // Skip social media and known non-company sites
                const skipDomains = [
                    'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com',
                    'youtube.com', 'wikipedia.org', 'duckduckgo.com', 'google.com',
                    'bing.com', 'yahoo.com', 'reddit.com', 'github.com'
                ];
                
                const isSkipped = skipDomains.some(domain => url.includes(domain));
                
                if (!isSkipped) {
                    // Check if URL might be related to company name
                    const urlLower = url.toLowerCase();
                    if (urlLower.includes(cleanName.substring(0, 5))) {
                        urls.push(url);
                    }
                }
            });
        }
        
        return urls;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = WebSearchReal;