#!/usr/bin/env node

/**
 * Demo: Phase 1 Fallback Mechanisms
 * Shows how job and funding fallback scraping works
 */

const JobScraperFallback = require('./modules/job-scraper-fallback');
const FundingScraperFallback = require('./modules/funding-scraper-fallback');

async function demoFallbackMechanisms() {
    console.log('🚀 Demo: Phase 1 Fallback Mechanisms');
    console.log('=====================================\n');

    // Test companies (you can modify these)
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
        }
    ];

    // Initialize fallback scrapers
    const jobScraper = new JobScraperFallback({
        timeout: 10000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const fundingScraper = new FundingScraperFallback({
        timeout: 10000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        recentThresholdMonths: 12
    });

    console.log('🔍 Testing Job Opening Fallback Methods');
    console.log('----------------------------------------');

    for (const company of testCompanies) {
        console.log(`\\n📊 Testing: ${company.name}`);
        console.log(`   Website: ${company.website}`);
        console.log(`   LinkedIn: ${company.linkedin_url}`);
        console.log(`   Employees: ${company.employee_count}`);

        try {
            // Test job fallback methods
            const jobResults = await jobScraper.findJobOpenings(company);
            
            console.log(`\\n   🏢 Job Fallback Results:`);
            console.log(`      Found: ${jobResults.found ? 'Yes' : 'No'}`);
            console.log(`      Sources: ${jobResults.sources.join(', ') || 'None'}`);
            console.log(`      Sales roles: ${jobResults.hasSales ? 'Yes' : 'No'}`);
            console.log(`      Marketing roles: ${jobResults.hasMarketing ? 'Yes' : 'No'}`);
            console.log(`      BD roles: ${jobResults.hasBD ? 'Yes' : 'No'}`);
            console.log(`      Confidence: ${jobResults.confidence.toFixed(2)}`);
            
            if (jobResults.jobTitles.length > 0) {
                console.log(`      Job titles found: ${jobResults.jobTitles.slice(0, 3).join(', ')}`);
            }

        } catch (error) {
            console.log(`   ❌ Job scraping error: ${error.message}`);
        }

        // Add delay between companies
        await delay(2000);
    }

    console.log('\\n\\n💰 Testing Funding Data Fallback Methods');
    console.log('------------------------------------------');

    for (const company of testCompanies) {
        console.log(`\\n📊 Testing: ${company.name}`);

        try {
            // Test funding fallback methods
            const fundingResults = await fundingScraper.findFundingData(company);
            
            console.log(`\\n   💼 Funding Fallback Results:`);
            console.log(`      Found: ${fundingResults.found ? 'Yes' : 'No'}`);
            console.log(`      Sources: ${fundingResults.sources.join(', ') || 'None'}`);
            console.log(`      Recent funding: ${fundingResults.recentFunding ? 'Yes' : 'No'}`);
            console.log(`      Confidence: ${fundingResults.confidence.toFixed(2)}`);
            
            if (fundingResults.fundingRounds.length > 0) {
                console.log(`      Funding rounds: ${fundingResults.fundingRounds.length}`);
                console.log(`      Total amount: ${fundingResults.totalAmount || 'Not specified'}`);
                console.log(`      Last funding: ${fundingResults.lastFundingDate || 'Unknown'}`);
            }
            
            if (fundingResults.details.length > 0) {
                console.log(`      Details: ${fundingResults.details[0].text.substring(0, 100)}...`);
            }

        } catch (error) {
            console.log(`   ❌ Funding scraping error: ${error.message}`);
        }

        // Add delay between companies
        await delay(2000);
    }

    console.log('\\n\\n📊 Phase 1 Fallback Demo Summary');
    console.log('==================================');
    console.log('✅ Demonstrated fallback methods:');
    console.log('   🏢 Job Opening Detection:');
    console.log('      • Career page scraping');
    console.log('      • Google search simulation');
    console.log('      • LinkedIn public page scraping');
    console.log('\\n   💰 Funding Data Detection:');
    console.log('      • Press release scraping');  
    console.log('      • News search simulation');
    console.log('      • LinkedIn funding announcements');
    console.log('\\n🔄 Next Steps:');
    console.log('   • Integrate enhanced analyzers into main pipeline');
    console.log('   • Configure fallback trigger conditions');
    console.log('   • Monitor success rates and adjust thresholds');
    console.log('\\n💡 Phase 2 Future Enhancements:');
    console.log('   • Real Google Custom Search API');
    console.log('   • Job board integrations (Indeed, Glassdoor)');
    console.log('   • Patent/trademark monitoring');
    console.log('   • Advanced AI content analysis');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
if (require.main === module) {
    demoFallbackMechanisms()
        .then(() => {
            console.log('\\n✅ Demo completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\\n❌ Demo failed:', error);
            process.exit(1);
        });
}

module.exports = { demoFallbackMechanisms };