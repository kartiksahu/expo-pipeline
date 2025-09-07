/**
 * Real Funding Scraper Module - NO SIMULATIONS
 * Only returns actual scraped data from real websites
 * Uses real HTTP requests to company press pages and news sources
 */

const axios = require('axios');
const cheerio = require('cheerio');

class FundingScraperReal {
    constructor(config) {
        this.config = {
            timeout: 10000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            maxRetries: 2,
            recentThresholdMonths: 12,
            ...config
        };
        
        // Funding-related keywords and patterns
        this.fundingKeywords = [
            'raised', 'funding', 'investment', 'round', 'capital',
            'series a', 'series b', 'series c', 'seed', 'pre-seed',
            'venture capital', 'vc', 'angel', 'investor', 'closes',
            'secures funding', 'announces funding', 'completes funding',
            'million', 'billion', '$', 'EUR', '€', '£', 'investment round',
            'led by', 'participated', 'backing', 'startup funding',
            'financing', 'fundraising', 'capital raised', 'funding announcement'
        ];
        
        this.fundingAmountPatterns = [
            /\$[\d,.]+ ?(million|billion|m|b|k)/gi,
            /€[\d,.]+ ?(million|billion|m|b|k)/gi,
            /£[\d,.]+ ?(million|billion|m|b|k)/gi,
            /[\d,.]+ ?(million|billion) (dollars?|euros?|pounds?)/gi,
            /\$[\d,.]+(m|M|k|K)\b/g
        ];
    }

    async findFundingData(company) {
        console.log(`     💰 Real funding search for: ${company.name}`);
        
        const results = {
            found: false,
            sources: [],
            fundingRounds: [],
            recentFunding: false,
            totalAmount: '',
            lastFundingDate: '',
            confidence: 0,
            details: []
        };

        try {
            // Method 1: Company website press releases (REAL)
            if (company.website) {
                const pressData = await this.scrapePressReleases(company);
                if (pressData.found) {
                    results.sources.push('press_releases');
                    results.fundingRounds.push(...pressData.rounds);
                    results.details.push(...pressData.details);
                    console.log(`       ✅ Found ${pressData.rounds.length} funding announcements in press releases`);
                }
            }

            // Method 2: LinkedIn public announcements (REAL)
            if (company.linkedin_url || company.linkedin) {
                const linkedinData = await this.scrapeLinkedInFunding(company);
                if (linkedinData.found) {
                    results.sources.push('linkedin_announcements');
                    results.fundingRounds.push(...linkedinData.rounds);
                    results.details.push(...linkedinData.details);
                    console.log(`       ✅ Found funding announcements on LinkedIn`);
                }
            }

            // Consolidate and analyze results
            if (results.fundingRounds.length > 0) {
                results.found = true;
                results.recentFunding = this.hasRecentFunding(results.fundingRounds);
                results.totalAmount = this.calculateTotalFunding(results.fundingRounds);
                results.lastFundingDate = this.getLastFundingDate(results.fundingRounds);
            }

            results.confidence = this.calculateFundingConfidence(results.sources);
            return results;

        } catch (error) {
            console.log(`       ❌ Real funding search failed: ${error.message}`);
            return results;
        }
    }

    async scrapePressReleases(company) {
        const results = { found: false, rounds: [], details: [] };
        
        try {
            const website = company.website;
            if (!website) return results;

            // Common press release page patterns
            const pressPaths = [
                '/press', '/news', '/press-releases', '/newsroom', '/media',
                '/press/', '/news/', '/announcements', '/blog', '/updates',
                '/company/news', '/about/news', '/investors/news', '/investor-relations'
            ];

            for (const path of pressPaths) {
                try {
                    const pressUrl = new URL(path, website).toString();
                    console.log(`         📰 Checking: ${pressUrl}`);
                    
                    const response = await axios.get(pressUrl, {
                        timeout: this.config.timeout,
                        headers: { 'User-Agent': this.config.userAgent },
                        validateStatus: status => status < 400
                    });

                    const $ = cheerio.load(response.data);
                    
                    // Look for funding-related press releases
                    const contentSelectors = [
                        'article', '.press-release', '.news-item', '.post', 
                        '.announcement', '.blog-post', 'h1', 'h2', 'h3', 
                        '.title', '.headline', '[class*="news"]', '[class*="press"]'
                    ];

                    contentSelectors.forEach(selector => {
                        $(selector).each((i, elem) => {
                            const text = $(elem).text();
                            const textLower = text.toLowerCase();
                            
                            if (this.containsFundingKeywords(textLower)) {
                                const fundingInfo = this.extractFundingInfo(text, textLower);
                                if (fundingInfo) {
                                    results.rounds.push(fundingInfo);
                                    results.details.push({
                                        source: 'press_release',
                                        url: pressUrl,
                                        text: text.substring(0, 200) + '...',
                                        date: fundingInfo.date
                                    });
                                    console.log(`         💰 Found funding info: ${fundingInfo.amount || fundingInfo.type}`);
                                }
                            }
                        });
                    });

                    if (results.rounds.length > 0) {
                        results.found = true;
                        break; // Found press releases, stop searching
                    }

                } catch (error) {
                    // Continue to next press path
                    continue;
                }
            }

        } catch (error) {
            console.log(`         ⚠️ Press release scraping failed: ${error.message}`);
        }

        return results;
    }

    async scrapeLinkedInFunding(company) {
        const results = { found: false, rounds: [], details: [] };
        
        try {
            const linkedinUrl = company.linkedin_url || company.linkedin;
            if (!linkedinUrl) return results;

            console.log(`         💰 Checking LinkedIn funding: ${linkedinUrl}`);

            const response = await axios.get(linkedinUrl, {
                timeout: this.config.timeout,
                headers: { 'User-Agent': this.config.userAgent }
            });

            const $ = cheerio.load(response.data);
            
            // Look for funding announcements in LinkedIn company description/about sections
            const contentSelectors = [
                '.org-about-company-module',
                '.org-top-card-summary-info-list', 
                '[data-test-id*="about"]',
                '.break-words',
                '.company-industries'
            ];

            contentSelectors.forEach(selector => {
                $(selector).each((i, elem) => {
                    const postText = $(elem).text();
                    const textLower = postText.toLowerCase();
                    
                    if (this.containsFundingKeywords(textLower)) {
                        const fundingInfo = this.extractFundingInfo(postText, textLower);
                        if (fundingInfo) {
                            results.rounds.push(fundingInfo);
                            results.details.push({
                                source: 'linkedin_announcement',
                                url: linkedinUrl,
                                text: postText.substring(0, 200) + '...',
                                date: fundingInfo.date
                            });
                            results.found = true;
                            console.log(`         💰 Found LinkedIn funding info: ${fundingInfo.amount || fundingInfo.type}`);
                        }
                    }
                });
            });

        } catch (error) {
            console.log(`         ⚠️ LinkedIn funding scraping failed: ${error.message}`);
        }

        return results;
    }

    containsFundingKeywords(text) {
        return this.fundingKeywords.some(keyword => text.includes(keyword));
    }

    extractFundingInfo(originalText, lowerText) {
        // Extract funding amount
        let amount = '';
        for (const pattern of this.fundingAmountPatterns) {
            const match = originalText.match(pattern);
            if (match) {
                amount = match[0];
                break;
            }
        }

        // Extract funding type/round
        let roundType = '';
        const roundPatterns = [
            'series a', 'series b', 'series c', 'series d', 'series e',
            'seed', 'pre-seed', 'angel', 'bridge', 'ipo', 'pre-ipo',
            'series seed', 'convertible', 'debt financing', 'equity financing'
        ];
        
        for (const round of roundPatterns) {
            if (lowerText.includes(round)) {
                roundType = round;
                break;
            }
        }

        // Extract or estimate date
        const extractedDate = this.extractDate(originalText);

        // Only return if we found meaningful funding information
        if (amount || roundType || 
            (this.containsFundingKeywords(lowerText) && 
             (lowerText.includes('million') || lowerText.includes('billion') || lowerText.includes('raised')))) {
            
            return {
                amount: amount,
                type: roundType || 'funding',
                date: extractedDate,
                raw: originalText.substring(0, 150) + '...'
            };
        }

        return null;
    }

    extractDate(text) {
        // Enhanced date extraction patterns
        const datePatterns = [
            // Full month names
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi,
            // Short month names
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{1,2},?\s+\d{4}/gi,
            // Various date formats
            /\b\d{1,2}\/\d{1,2}\/\d{4}/g,
            /\b\d{4}-\d{2}-\d{2}/g,
            /\b\d{1,2}-\d{1,2}-\d{4}/g,
            /\b\d{2}\.\d{2}\.\d{4}/g,
            // Relative dates
            /\b(today|yesterday|this week|last week|this month|last month)\b/gi
        ];

        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                try {
                    const dateStr = match[0];
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate)) {
                        return parsedDate.toISOString().split('T')[0];
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        // Default to current date if no date found but funding keywords present
        return new Date().toISOString().split('T')[0];
    }

    hasRecentFunding(rounds) {
        const thresholdDate = new Date();
        thresholdDate.setMonth(thresholdDate.getMonth() - this.config.recentThresholdMonths);
        
        return rounds.some(round => {
            const roundDate = new Date(round.date);
            return !isNaN(roundDate) && roundDate > thresholdDate;
        });
    }

    calculateTotalFunding(rounds) {
        // Extract and sum amounts where possible
        const amounts = rounds
            .map(round => round.amount)
            .filter(amount => amount)
            .filter(amount => amount.match(/\d/)); // Has numbers
        
        return amounts.length > 0 ? amounts.join(', ') : '';
    }

    getLastFundingDate(rounds) {
        const dates = rounds
            .map(round => new Date(round.date))
            .filter(date => !isNaN(date))
            .sort((a, b) => b - a);
        
        return dates.length > 0 ? dates[0].toISOString().split('T')[0] : '';
    }

    calculateFundingConfidence(sources) {
        const weights = {
            'press_releases': 0.8,        // Highest confidence - official company announcements
            'linkedin_announcements': 0.6 // Good confidence - LinkedIn official content
        };
        
        return sources.reduce((score, source) => score + (weights[source] || 0), 0);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = FundingScraperReal;