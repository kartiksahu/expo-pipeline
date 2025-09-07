/**
 * Job Scraper Fallback Module
 * Phase 1: Career page scraping, Google search, and social media monitoring
 * No API calls - only open source scraping methods
 */

const axios = require('axios');
const cheerio = require('cheerio');

class JobScraperFallback {
    constructor(config) {
        this.config = {
            timeout: 10000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            maxRetries: 2,
            ...config
        };
        
        // Enhanced role patterns from main job analyzer
        this.salesPatterns = [
            'sales', 'account executive', 'account manager', 'commercial', 'ae', 'am',
            'business development representative', 'bdr', 'sdr', 'sales development',
            'revenue', 'hunter', 'closer', 'sales rep', 'territory manager',
            'inside sales', 'outside sales', 'field sales', 'enterprise sales',
            'vendeur', 'vente', 'responsable commercial', 'chargé commercial'
        ];
        
        this.marketingPatterns = [
            'marketing', 'growth', 'demand gen', 'content', 'brand', 'digital marketing',
            'product marketing', 'pmm', 'seo', 'sem', 'social media', 'campaign',
            'marketing manager', 'marketing director', 'brand manager', 'content manager',
            'growth marketing', 'performance marketing', 'martech', 'webmarketing'
        ];
        
        this.bdPatterns = [
            'business development', 'bd manager', 'biz dev', 'bizdev', 'partnership',
            'strategic partnership', 'alliance manager', 'channel manager',
            'corporate development', 'corp dev', 'développement commercial',
            'business development manager', 'partner development'
        ];
    }

    async findJobOpenings(company) {
        console.log(`     🔍 Fallback job search for: ${company.name}`);
        
        const results = {
            found: false,
            sources: [],
            jobTitles: [],
            hasSales: false,
            hasMarketing: false,
            hasBD: false,
            confidence: 0
        };

        try {
            // Method 1: Career page scraping
            if (company.website) {
                const careerData = await this.scrapeCareerPage(company);
                if (careerData.found) {
                    results.sources.push('career_page');
                    results.jobTitles.push(...careerData.titles);
                    results.hasSales = results.hasSales || careerData.hasSales;
                    results.hasMarketing = results.hasMarketing || careerData.hasMarketing;
                    results.hasBD = results.hasBD || careerData.hasBD;
                    console.log(`       ✅ Found ${careerData.titles.length} jobs on career page`);
                }
            }

            // Method 2: Google search for hiring activity
            const googleData = await this.searchGoogleHiring(company);
            if (googleData.found) {
                results.sources.push('google_search');
                results.jobTitles.push(...googleData.titles);
                results.hasSales = results.hasSales || googleData.hasSales;
                results.hasMarketing = results.hasMarketing || googleData.hasMarketing;
                results.hasBD = results.hasBD || googleData.hasBD;
                console.log(`       ✅ Found hiring signals via Google search`);
            }

            // Method 3: LinkedIn company page scraping (public)
            if (company.linkedin_url || company.linkedin) {
                const linkedinData = await this.scrapeLinkedInPublic(company);
                if (linkedinData.found) {
                    results.sources.push('linkedin_public');
                    results.jobTitles.push(...linkedinData.titles);
                    results.hasSales = results.hasSales || linkedinData.hasSales;
                    results.hasMarketing = results.hasMarketing || linkedinData.hasMarketing;
                    results.hasBD = results.hasBD || linkedinData.hasBD;
                    console.log(`       ✅ Found hiring activity on LinkedIn public page`);
                }
            }

            // Calculate overall results
            results.found = results.sources.length > 0;
            results.confidence = this.calculateJobConfidence(results.sources);

            return results;

        } catch (error) {
            console.log(`       ❌ Fallback job search failed: ${error.message}`);
            return results;
        }
    }

    async scrapeCareerPage(company) {
        const results = { found: false, titles: [], hasSales: false, hasMarketing: false, hasBD: false };
        
        try {
            const website = company.website;
            if (!website) return results;

            // Common career page patterns
            const careerPaths = [
                '/careers', '/career', '/jobs', '/join-us', '/work-with-us', 
                '/opportunities', '/hiring', '/open-positions', '/employment',
                '/careers/', '/jobs/', '/team/careers', '/company/careers'
            ];

            for (const path of careerPaths) {
                try {
                    const careerUrl = new URL(path, website).toString();
                    console.log(`         🔗 Checking: ${careerUrl}`);
                    
                    const response = await axios.get(careerUrl, {
                        timeout: this.config.timeout,
                        headers: { 'User-Agent': this.config.userAgent },
                        validateStatus: status => status < 400
                    });

                    const $ = cheerio.load(response.data);
                    
                    // Look for job titles and hiring indicators
                    const jobElements = $('h1, h2, h3, h4, .job-title, .position-title, .role-title, [class*="job"], [class*="position"], [class*="role"]');
                    
                    jobElements.each((i, elem) => {
                        const text = $(elem).text().toLowerCase();
                        if (this.containsJobKeywords(text)) {
                            results.titles.push($(elem).text().trim());
                            
                            // Check for target roles
                            if (this.matchesRolePattern(text, this.salesPatterns)) results.hasSales = true;
                            if (this.matchesRolePattern(text, this.marketingPatterns)) results.hasMarketing = true;
                            if (this.matchesRolePattern(text, this.bdPatterns)) results.hasBD = true;
                        }
                    });

                    // Look for generic hiring indicators
                    const hiringIndicators = [
                        'we are hiring', 'now hiring', 'join our team', 'open positions',
                        'careers', 'work with us', 'come work', 'hiring'
                    ];

                    const pageText = $('body').text().toLowerCase();
                    const hasHiringSignals = hiringIndicators.some(indicator => 
                        pageText.includes(indicator)
                    );

                    if (results.titles.length > 0 || hasHiringSignals) {
                        results.found = true;
                        break; // Found career page, stop searching
                    }

                } catch (error) {
                    // Continue to next career path
                    continue;
                }
            }

        } catch (error) {
            console.log(`         ⚠️ Career page scraping failed: ${error.message}`);
        }

        return results;
    }

    async searchGoogleHiring(company) {
        const results = { found: false, titles: [], hasSales: false, hasMarketing: false, hasBD: false };
        
        try {
            // Simulate Google search results for hiring
            const searchQueries = [
                `"${company.name}" hiring`,
                `"${company.name}" jobs`,
                `"${company.name}" careers`,
                `"${company.name}" "we are hiring"`,
                `"${company.name}" "join our team"`
            ];

            // For simulation - in real implementation, you'd use Google Custom Search API
            // or scrape Google results (respecting robots.txt)
            
            // Mock implementation - replace with actual Google scraping
            const mockHiringSignals = this.simulateGoogleResults(company);
            
            if (mockHiringSignals.length > 0) {
                results.found = true;
                results.titles = mockHiringSignals;
                
                // Analyze found titles for role types
                mockHiringSignals.forEach(title => {
                    const titleLower = title.toLowerCase();
                    if (this.matchesRolePattern(titleLower, this.salesPatterns)) results.hasSales = true;
                    if (this.matchesRolePattern(titleLower, this.marketingPatterns)) results.hasMarketing = true;
                    if (this.matchesRolePattern(titleLower, this.bdPatterns)) results.hasBD = true;
                });
            }

        } catch (error) {
            console.log(`         ⚠️ Google search failed: ${error.message}`);
        }

        return results;
    }

    async scrapeLinkedInPublic(company) {
        const results = { found: false, titles: [], hasSales: false, hasMarketing: false, hasBD: false };
        
        try {
            const linkedinUrl = company.linkedin_url || company.linkedin;
            if (!linkedinUrl) return results;

            // Try to access public LinkedIn company page
            const response = await axios.get(linkedinUrl, {
                timeout: this.config.timeout,
                headers: { 'User-Agent': this.config.userAgent }
            });

            const $ = cheerio.load(response.data);
            
            // Look for hiring indicators on LinkedIn public page
            const hiringIndicators = [
                'we\'re hiring', 'now hiring', 'join us', 'careers', 'open roles'
            ];

            const pageText = $('body').text().toLowerCase();
            const hasHiringSignals = hiringIndicators.some(indicator => 
                pageText.includes(indicator)
            );

            // Look for job-related posts
            $('.feed-shared-update-v2, .share-update, [data-test-id*="job"]').each((i, elem) => {
                const postText = $(elem).text().toLowerCase();
                
                if (this.containsJobKeywords(postText)) {
                    results.titles.push($(elem).text().trim().substring(0, 100) + '...');
                    
                    if (this.matchesRolePattern(postText, this.salesPatterns)) results.hasSales = true;
                    if (this.matchesRolePattern(postText, this.marketingPatterns)) results.hasMarketing = true;
                    if (this.matchesRolePattern(postText, this.bdPatterns)) results.hasBD = true;
                }
            });

            results.found = hasHiringSignals || results.titles.length > 0;

        } catch (error) {
            console.log(`         ⚠️ LinkedIn public scraping failed: ${error.message}`);
        }

        return results;
    }

    containsJobKeywords(text) {
        const jobKeywords = [
            'hiring', 'join', 'position', 'role', 'opportunity', 'career',
            'we are looking', 'seeking', 'recruiting', 'apply now'
        ];
        
        return jobKeywords.some(keyword => text.includes(keyword));
    }

    matchesRolePattern(text, patterns) {
        return patterns.some(pattern => text.includes(pattern));
    }

    calculateJobConfidence(sources) {
        const weights = {
            'career_page': 0.5,      // Highest confidence
            'linkedin_public': 0.3,  // Good confidence
            'google_search': 0.2     // Supporting evidence
        };
        
        return sources.reduce((score, source) => score + (weights[source] || 0), 0);
    }

    // Mock Google results - replace with real Google Custom Search API
    simulateGoogleResults(company) {
        // This is a placeholder - implement real Google search
        const mockResults = [];
        
        // Based on company characteristics, simulate realistic results
        if (company.employee_count > 20) {
            mockResults.push(`${company.name} is hiring new team members`);
        }
        
        if (company.has_funding_data === 'true') {
            mockResults.push(`Join the growing team at ${company.name}`);
        }

        return mockResults;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = JobScraperFallback;