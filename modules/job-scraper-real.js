/**
 * Real Job Scraper Module - NO SIMULATIONS
 * Only returns actual scraped data from real websites
 * Uses Playwright for real web search when needed
 */

const axios = require('axios');
const cheerio = require('cheerio');

class JobScraperReal {
    constructor(config) {
        this.config = {
            timeout: 10000,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            maxRetries: 2,
            ...config
        };
        
        // Enhanced role patterns - same as before but REAL detection only
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
        console.log(`     🔍 Real job search for: ${company.name}`);
        
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
            // Method 1: Career page scraping (REAL)
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

            // Method 2: LinkedIn company page scraping (REAL)
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
            console.log(`       ❌ Real job search failed: ${error.message}`);
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
                    const jobElements = $('h1, h2, h3, h4, .job-title, .position-title, .role-title, [class*="job"], [class*="position"], [class*="role"], [class*="career"]');
                    
                    jobElements.each((i, elem) => {
                        const text = $(elem).text().toLowerCase();
                        if (this.containsJobKeywords(text)) {
                            const originalText = $(elem).text().trim()
                                .replace(/\s+/g, ' ')  // Clean multiple spaces
                                .replace(/[\r\n\t]/g, ' ')  // Remove line breaks and tabs
                                .replace(/[<>]/g, '')  // Remove any remaining HTML brackets
                                .trim();
                            if (originalText && originalText.length > 3 && originalText.length < 150 && !originalText.includes('<')) {
                                results.titles.push(originalText);
                                
                                // Check for target roles
                                if (this.matchesRolePattern(text, this.salesPatterns)) results.hasSales = true;
                                if (this.matchesRolePattern(text, this.marketingPatterns)) results.hasMarketing = true;
                                if (this.matchesRolePattern(text, this.bdPatterns)) results.hasBD = true;
                            }
                        }
                    });

                    // Look for generic hiring indicators
                    const hiringIndicators = [
                        'we are hiring', 'now hiring', 'join our team', 'open positions',
                        'careers', 'work with us', 'come work', 'hiring', 'join us'
                    ];

                    const pageText = $('body').text().toLowerCase();
                    const hasHiringSignals = hiringIndicators.some(indicator => 
                        pageText.includes(indicator)
                    );

                    // Also check for job application forms or buttons
                    const hasJobForms = $('form[action*="apply"], form[action*="job"], .apply-button, .job-apply, [href*="apply"]').length > 0;

                    if (results.titles.length > 0 || hasHiringSignals || hasJobForms) {
                        results.found = true;
                        console.log(`         📋 Found ${results.titles.length} job titles, hiring signals: ${hasHiringSignals}, job forms: ${hasJobForms}`);
                        break; // Found career page, stop searching
                    }

                } catch (error) {
                    // Continue to next career path if this one fails
                    continue;
                }
            }

        } catch (error) {
            console.log(`         ⚠️ Career page scraping failed: ${error.message}`);
        }

        return results;
    }

    async scrapeLinkedInPublic(company) {
        const results = { found: false, titles: [], hasSales: false, hasMarketing: false, hasBD: false };
        
        try {
            const linkedinUrl = company.linkedin_url || company.linkedin;
            if (!linkedinUrl) return results;

            console.log(`         🔗 Checking LinkedIn: ${linkedinUrl}`);

            // Try to access public LinkedIn company page
            const response = await axios.get(linkedinUrl, {
                timeout: this.config.timeout,
                headers: { 
                    'User-Agent': this.config.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Look for hiring indicators on LinkedIn public page
            const hiringKeywords = [
                'we\'re hiring', 'now hiring', 'join us', 'careers', 'open roles',
                'hiring', 'join our team', 'we are looking for', 'seeking'
            ];

            // Check main page content
            const pageText = $('body').text().toLowerCase();
            
            // Look for job-related content in various LinkedIn sections
            const contentSelectors = [
                '.org-about-company-module', 
                '.org-top-card-summary-info-list',
                '[data-test-id*="about"]',
                '.company-industries',
                '.break-words'
            ];

            let foundHiringContent = false;
            
            contentSelectors.forEach(selector => {
                $(selector).each((i, elem) => {
                    const sectionText = $(elem).text().toLowerCase();
                    
                    // Check for hiring keywords
                    hiringKeywords.forEach(keyword => {
                        if (sectionText.includes(keyword)) {
                            foundHiringContent = true;
                            const contextText = $(elem).text().trim();
                            if (contextText && contextText.length > 10) {
                                results.titles.push(contextText.substring(0, 200) + '...');
                                
                                // Check for role types
                                if (this.matchesRolePattern(sectionText, this.salesPatterns)) results.hasSales = true;
                                if (this.matchesRolePattern(sectionText, this.marketingPatterns)) results.hasMarketing = true;
                                if (this.matchesRolePattern(sectionText, this.bdPatterns)) results.hasBD = true;
                            }
                        }
                    });
                });
            });

            results.found = foundHiringContent;
            
            if (results.found) {
                console.log(`         📋 Found hiring content in LinkedIn page`);
            }

        } catch (error) {
            console.log(`         ⚠️ LinkedIn public scraping failed: ${error.message}`);
        }

        return results;
    }

    containsJobKeywords(text) {
        const jobKeywords = [
            'hiring', 'join', 'position', 'role', 'opportunity', 'career',
            'we are looking', 'seeking', 'recruiting', 'apply now', 'job opening',
            'employment', 'vacancy', 'recruit', 'team member', 'looking for'
        ];
        
        return jobKeywords.some(keyword => text.includes(keyword));
    }

    matchesRolePattern(text, patterns) {
        return patterns.some(pattern => text.includes(pattern));
    }

    calculateJobConfidence(sources) {
        const weights = {
            'career_page': 0.7,      // Highest confidence - direct from company
            'linkedin_public': 0.5   // Good confidence - LinkedIn official
        };
        
        return sources.reduce((score, source) => score + (weights[source] || 0), 0);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = JobScraperReal;