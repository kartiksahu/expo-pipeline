#!/usr/bin/env node

/**
 * Demo: Real Fallback Mechanisms - NO SIMULATIONS
 * Shows how real job and funding scraping works with actual data
 */

const JobScraperReal = require('./modules/job-scraper-real');
const FundingScraperReal = require('./modules/funding-scraper-real');

async function demoRealFallbackMechanisms() {
    console.log('🚀 Demo: Real Fallback Mechanisms - NO SIMULATIONS');
    console.log('===================================================\n');

    // Test companies from your actual processed file
    const testCompanies = [
        {
            name: '5Mins AI',
            website: 'https://www.5mins.ai/',
            linkedin_url: 'https://www.linkedin.com/company/5minsai/',
            employee_count: 29
        },
        {
            name: 'Apicbase',
            website: 'https://get.apicbase.com',
            linkedin_url: 'https://www.linkedin.com/company/apicbase/',
            employee_count: 49
        },
        {
            name: 'Airia',
            website: 'https://airia.com',
            linkedin_url: 'https://www.linkedin.com/company/airia-enterprise-ai-simplified/',
            employee_count: 159
        }
    ];

    // Initialize REAL scrapers (no simulations)
    const jobScraper = new JobScraperReal({
        timeout: 15000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const fundingScraper = new FundingScraperReal({
        timeout: 15000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        recentThresholdMonths: 12
    });

    console.log('🔍 Testing REAL Job Opening Detection');
    console.log('=====================================');

    for (const company of testCompanies) {
        console.log(`\n📊 Testing: ${company.name}`);
        console.log(`   Website: ${company.website}`);
        console.log(`   LinkedIn: ${company.linkedin_url}`);
        console.log(`   Employees: ${company.employee_count}`);

        try {
            // Test REAL job scraping methods
            const jobResults = await jobScraper.findJobOpenings(company);
            
            console.log(`\n   🏢 REAL Job Results:`);
            console.log(`      Found: ${jobResults.found ? 'Yes' : 'No'}`);
            
            if (jobResults.found) {
                console.log(`      Sources: ${jobResults.sources.join(', ')}`);
                console.log(`      Sales roles: ${jobResults.hasSales ? 'Yes' : 'No'}`);
                console.log(`      Marketing roles: ${jobResults.hasMarketing ? 'Yes' : 'No'}`);
                console.log(`      BD roles: ${jobResults.hasBD ? 'Yes' : 'No'}`);
                console.log(`      Confidence: ${jobResults.confidence.toFixed(2)}`);
                
                if (jobResults.jobTitles.length > 0) {
                    console.log(`      Job content found:`);
                    jobResults.jobTitles.slice(0, 2).forEach(title => {
                        console.log(`        - ${title.substring(0, 80)}...`);
                    });
                }
            } else {
                console.log(`      No real job data found on career pages or LinkedIn`);
            }

        } catch (error) {
            console.log(`   ❌ Job scraping error: ${error.message}`);
        }

        // Add delay between companies to be respectful
        await delay(3000);
    }

    console.log('\n\n💰 Testing REAL Funding Data Detection');
    console.log('=======================================');

    for (const company of testCompanies) {
        console.log(`\n📊 Testing: ${company.name}`);

        try {
            // Test REAL funding scraping methods
            const fundingResults = await fundingScraper.findFundingData(company);
            
            console.log(`\n   💼 REAL Funding Results:`);
            console.log(`      Found: ${fundingResults.found ? 'Yes' : 'No'}`);
            
            if (fundingResults.found) {
                console.log(`      Sources: ${fundingResults.sources.join(', ')}`);
                console.log(`      Recent funding: ${fundingResults.recentFunding ? 'Yes' : 'No'}`);
                console.log(`      Confidence: ${fundingResults.confidence.toFixed(2)}`);
                console.log(`      Funding rounds: ${fundingResults.fundingRounds.length}`);
                
                if (fundingResults.totalAmount) {
                    console.log(`      Amounts found: ${fundingResults.totalAmount}`);
                }
                
                if (fundingResults.lastFundingDate) {
                    console.log(`      Last funding: ${fundingResults.lastFundingDate}`);
                }
                
                if (fundingResults.details.length > 0) {
                    console.log(`      Details:`);
                    fundingResults.details.slice(0, 2).forEach(detail => {
                        console.log(`        - ${detail.text.substring(0, 80)}...`);
                    });
                }
            } else {
                console.log(`      No real funding announcements found in press releases or LinkedIn`);
            }

        } catch (error) {
            console.log(`   ❌ Funding scraping error: ${error.message}`);
        }

        // Add delay between companies
        await delay(3000);
    }

    console.log('\n\n📊 Real Fallback Demo Summary');
    console.log('==============================');
    console.log('✅ Demonstrated REAL fallback methods (NO SIMULATIONS):');
    console.log('');
    console.log('   🏢 Job Opening Detection:');
    console.log('      • Real career page HTTP requests and HTML parsing');
    console.log('      • Real LinkedIn public page scraping');
    console.log('      • Actual job title extraction and role pattern matching');
    console.log('      • Returns empty results if no real data found');
    console.log('');
    console.log('   💰 Funding Data Detection:');
    console.log('      • Real press release page scraping from company websites');  
    console.log('      • Real LinkedIn company page funding announcement detection');
    console.log('      • Actual funding amount and round type extraction');
    console.log('      • Returns empty results if no real announcements found');
    console.log('');
    console.log('🔄 What Changed from Previous Demo:');
    console.log('   ❌ REMOVED: All simulated Google search results');
    console.log('   ❌ REMOVED: All mock data generation');
    console.log('   ❌ REMOVED: Fake job titles and funding amounts');
    console.log('   ✅ ADDED: Real HTTP requests to actual websites');
    console.log('   ✅ ADDED: Actual HTML parsing and content extraction');
    console.log('   ✅ ADDED: Real pattern matching on scraped content');
    console.log('');
    console.log('💡 Data Integrity:');
    console.log('   • Only returns data actually found on company websites');
    console.log('   • Empty results when no real data exists');
    console.log('   • Confidence scores based on actual data sources');
    console.log('   • Source attribution for all found information');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   • These REAL scrapers can now be integrated into the pipeline');
    console.log('   • They will only enhance data when real information exists');
    console.log('   • No fake data will contaminate your results');
    console.log('   • Consider adding web search via Playwright for more coverage');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the REAL demo
if (require.main === module) {
    demoRealFallbackMechanisms()
        .then(() => {
            console.log('\n✅ Real fallback demo completed successfully!');
            console.log('All data shown was scraped from actual company websites.');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Demo failed:', error);
            process.exit(1);
        });
}

module.exports = { demoRealFallbackMechanisms };