/**
 * Playwright-Enhanced Web Search Module
 * Provides real web search capabilities for job and funding discovery
 * NO SIMULATIONS - Only returns actual search results
 */

class PlaywrightWebSearch {
    constructor(config = {}) {
        this.config = {
            timeout: 15000,
            waitTime: 3000,
            maxResults: 5,
            ...config
        };
    }

    /**
     * Search for hiring-related content for a company
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

        // Use the existing playwright integration if available
        if (typeof mcp__playwright__playwright_navigate === 'function') {
            try {
                console.log(`       🔍 Playwright search for jobs: ${companyName}`);
                
                // Search for company hiring on DuckDuckGo (more permissive than Google)
                const searchUrl = `https://duckduckgo.com/?q="${companyName}"+hiring+jobs+careers`;
                
                await mcp__playwright__playwright_navigate({ url: searchUrl });
                await this.delay(this.config.waitTime);
                
                // Get search results
                const searchHtml = await mcp__playwright__playwright_get_visible_html({ 
                    removeScripts: true,
                    maxLength: 10000
                });
                
                if (searchHtml) {
                    const jobData = this.extractJobDataFromSearch(searchHtml, companyName);
                    if (jobData.found) {
                        results.found = true;
                        results.sources.push('web_search');
                        results.jobTitles.push(...jobData.titles);
                        results.hasSales = jobData.hasSales;
                        results.hasMarketing = jobData.hasMarketing;
                        results.hasBD = jobData.hasBD;
                        results.searchUrls.push(searchUrl);
                    }
                }
                
            } catch (error) {
                console.log(`       ⚠️ Playwright job search failed: ${error.message}`);
            }
        }

        return results;
    }

    /**
     * Search for funding-related content for a company
     */
    async searchFundingAnnouncements(companyName) {
        const results = {
            found: false,
            sources: [],
            fundingRounds: [],
            searchUrls: []
        };

        if (typeof mcp__playwright__playwright_navigate === 'function') {
            try {
                console.log(`       💰 Playwright search for funding: ${companyName}`);
                
                // Search for company funding news
                const searchUrl = `https://duckduckgo.com/?q="${companyName}"+funding+raised+investment+series`;
                
                await mcp__playwright__playwright_navigate({ url: searchUrl });
                await this.delay(this.config.waitTime);
                
                const searchHtml = await mcp__playwright__playwright_get_visible_html({ 
                    removeScripts: true,
                    maxLength: 10000
                });
                
                if (searchHtml) {
                    const fundingData = this.extractFundingDataFromSearch(searchHtml, companyName);
                    if (fundingData.found) {
                        results.found = true;
                        results.sources.push('web_search');
                        results.fundingRounds.push(...fundingData.rounds);
                        results.searchUrls.push(searchUrl);
                    }
                }
                
            } catch (error) {
                console.log(`       ⚠️ Playwright funding search failed: ${error.message}`);
            }
        }

        return results;
    }

    /**
     * Extract job-related information from search results HTML
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

            // Look for hiring indicators in search results
            const hiringIndicators = [
                'hiring', 'jobs', 'careers', 'join', 'work with us', 'we are looking',
                'open positions', 'now hiring', 'job openings', 'employment'
            ];

            const hasHiringContent = hiringIndicators.some(indicator => 
                lowerHtml.includes(indicator) && lowerHtml.includes(companyLower)
            );

            if (hasHiringContent) {
                results.found = true;
                
                // Extract potential job titles from search snippets
                const jobPatterns = [
                    /hiring\s+([a-z\s]{10,50})/gi,
                    /looking for\s+([a-z\s]{10,50})/gi,
                    /join our team\s+([a-z\s]{10,50})/gi
                ];

                jobPatterns.forEach(pattern => {
                    const matches = html.match(pattern);
                    if (matches) {
                        matches.slice(0, 3).forEach(match => {
                            results.titles.push(match.trim());
                        });
                    }
                });

                // Check for role types
                const salesPatterns = ['sales', 'account manager', 'business development', 'commercial'];
                const marketingPatterns = ['marketing', 'growth', 'brand', 'digital marketing'];
                const bdPatterns = ['business development', 'partnership', 'alliance'];

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
     * Extract funding information from search results HTML
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

                // Extract funding amounts and types
                const amountPatterns = [
                    /\$[\d,.]+ ?(million|billion|m|b)/gi,
                    /€[\d,.]+ ?(million|billion|m|b)/gi
                ];

                const typePatterns = [
                    /series [abc]/gi,
                    /seed round/gi,
                    /angel investment/gi
                ];

                amountPatterns.forEach(pattern => {
                    const matches = html.match(pattern);
                    if (matches) {
                        matches.slice(0, 2).forEach(match => {
                            results.rounds.push({
                                amount: match,
                                type: 'funding',
                                date: new Date().toISOString().split('T')[0],
                                raw: `Found in search: ${match}`
                            });
                        });
                    }
                });

                typePatterns.forEach(pattern => {
                    const matches = html.match(pattern);
                    if (matches && results.rounds.length === 0) {
                        results.rounds.push({
                            amount: '',
                            type: matches[0],
                            date: new Date().toISOString().split('T')[0],
                            raw: `Found in search: ${matches[0]}`
                        });
                    }
                });
            }

        } catch (error) {
            console.log(`       ⚠️ Funding data extraction failed: ${error.message}`);
        }

        return results;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = PlaywrightWebSearch;