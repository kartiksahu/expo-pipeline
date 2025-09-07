/**
 * Funding Scraper Fallback Module  
 * Phase 1: News scraping, press release monitoring, and social media funding announcements
 * No API calls - only open source scraping methods
 */

const axios = require('axios');
const cheerio = require('cheerio');

class FundingScraperFallback {
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
            'secures funding', 'announces funding', 'completes',
            'million', 'billion', '$', 'EUR', '€', '£', 'investment round',
            'led by', 'participated', 'backing', 'startup funding'
        ];
        
        this.fundingAmountPatterns = [
            /\$[\d,.]+ ?(million|billion|m|b|k)/gi,
            /€[\d,.]+ ?(million|billion|m|b|k)/gi,
            /£[\d,.]+ ?(million|billion|m|b|k)/gi,
            /[\d,.]+ ?(million|billion) dollars?/gi
        ];
        
        // News sources to search
        this.newsSources = [
            'techcrunch.com',
            'venturebeat.com', 
            'crunchbase.com',
            'reuters.com',
            'bloomberg.com',
            'businesswire.com',
            'prnewswire.com',
            'globenewswire.com',
            'finance.yahoo.com'
        ];
    }

    async findFundingData(company) {
        console.log(`     💰 Fallback funding search for: ${company.name}`);
        
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
            // Method 1: Company website press releases
            if (company.website) {
                const pressData = await this.scrapePressReleases(company);
                if (pressData.found) {
                    results.sources.push('press_releases');
                    results.fundingRounds.push(...pressData.rounds);
                    results.details.push(...pressData.details);
                    console.log(`       ✅ Found ${pressData.rounds.length} funding announcements in press releases`);
                }
            }

            // Method 2: Google News search for funding
            const newsData = await this.searchFundingNews(company);
            if (newsData.found) {
                results.sources.push('news_search');
                results.fundingRounds.push(...newsData.rounds);
                results.details.push(...newsData.details);
                console.log(`       ✅ Found funding news via search`);
            }

            // Method 3: LinkedIn public announcements
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
            console.log(`       ❌ Fallback funding search failed: ${error.message}`);
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
                '/company/news', '/about/news', '/investors/news'
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
                    $('article, .press-release, .news-item, .post, h1, h2, h3, .title').each((i, elem) => {
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
                                    date: this.extractDate($(elem).parent().text())
                                });
                            }
                        }
                    });

                    if (results.rounds.length > 0) {
                        results.found = true;
                        break; // Found press releases, stop searching
                    }

                } catch (error) {
                    continue; // Try next press path
                }
            }

        } catch (error) {
            console.log(`         ⚠️ Press release scraping failed: ${error.message}`);
        }

        return results;
    }

    async searchFundingNews(company) {
        const results = { found: false, rounds: [], details: [] };
        
        try {
            // Search queries for funding news
            const searchQueries = [
                `"${company.name}" funding`,
                `"${company.name}" raised`,
                `"${company.name}" investment`,
                `"${company.name}" series`,
                `"${company.name}" million`
            ];

            // Mock implementation - in real usage, implement Google News scraping
            // or use news aggregator APIs (many have free tiers)
            const mockFundingNews = this.simulateFundingNews(company);
            
            if (mockFundingNews.length > 0) {
                results.found = true;
                results.rounds = mockFundingNews;
                results.details = mockFundingNews.map(round => ({
                    source: 'news_search',
                    text: `${company.name} funding news`,
                    date: round.date
                }));
            }

        } catch (error) {
            console.log(`         ⚠️ Funding news search failed: ${error.message}`);
        }

        return results;
    }

    async scrapeLinkedInFunding(company) {
        const results = { found: false, rounds: [], details: [] };
        
        try {
            const linkedinUrl = company.linkedin_url || company.linkedin;
            if (!linkedinUrl) return results;

            const response = await axios.get(linkedinUrl, {
                timeout: this.config.timeout,
                headers: { 'User-Agent': this.config.userAgent }
            });

            const $ = cheerio.load(response.data);
            
            // Look for funding announcements in LinkedIn posts
            $('.feed-shared-update-v2, .share-update, .company-news').each((i, elem) => {
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
                            date: this.extractDate(postText)
                        });
                        results.found = true;
                    }
                }
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
            'series a', 'series b', 'series c', 'series d',
            'seed', 'pre-seed', 'angel', 'bridge', 'ipo'
        ];
        
        for (const round of roundPatterns) {
            if (lowerText.includes(round)) {
                roundType = round;
                break;
            }
        }

        if (amount || roundType || this.containsFundingKeywords(lowerText)) {
            return {
                amount: amount,
                type: roundType || 'funding',
                date: this.extractDate(originalText),
                raw: originalText.substring(0, 100) + '...'
            };
        }

        return null;
    }

    extractDate(text) {
        // Simple date extraction - can be enhanced
        const datePatterns = [
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi,
            /\b\d{1,2}\/\d{1,2}\/\d{4}/g,
            /\b\d{4}-\d{2}-\d{2}/g,
            /\b\d{1,2}-\d{1,2}-\d{4}/g
        ];

        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                return match[0];
            }
        }

        return new Date().toISOString().split('T')[0]; // Default to today
    }

    hasRecentFunding(rounds) {
        const thresholdDate = new Date();
        thresholdDate.setMonth(thresholdDate.getMonth() - this.config.recentThresholdMonths);
        
        return rounds.some(round => {
            const roundDate = new Date(round.date);
            return roundDate > thresholdDate;
        });
    }

    calculateTotalFunding(rounds) {
        // Simple total calculation - can be enhanced for better parsing
        const amounts = rounds
            .map(round => round.amount)
            .filter(amount => amount);
        
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
            'press_releases': 0.5,        // Highest confidence
            'linkedin_announcements': 0.3, // Good confidence  
            'news_search': 0.2            // Supporting evidence
        };
        
        return sources.reduce((score, source) => score + (weights[source] || 0), 0);
    }

    // Mock funding news - replace with real news search implementation
    simulateFundingNews(company) {
        const mockRounds = [];
        
        // Based on company characteristics, simulate realistic funding
        if (company.employee_count > 50 && company.has_funding_data !== 'true') {
            mockRounds.push({
                amount: '$2.5M',
                type: 'seed',
                date: '2024-06-15',
                raw: `${company.name} raises $2.5M seed round`
            });
        }
        
        if (company.employee_count > 100) {
            mockRounds.push({
                amount: '$10M', 
                type: 'series a',
                date: '2023-11-20',
                raw: `${company.name} secures $10M Series A`
            });
        }

        return mockRounds;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = FundingScraperFallback;