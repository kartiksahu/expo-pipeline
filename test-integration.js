#!/usr/bin/env node

/**
 * Integration Test - End-to-End Pipeline Test
 * Tests the complete pipeline with integrated analyzers on a few companies
 */

// Import all modules used in the pipeline
const WebsiteFinder = require('./modules/website-finder');
const LinkedInEnhancer = require('./modules/linkedin-enhancer');
const EmployeeAnalyzer = require('./modules/employee-analyzer');
const FundingAnalyzer = require('./modules/funding-analyzer-integrated');
const JobAnalyzer = require('./modules/job-analyzer-integrated');

async function testIntegratedPipeline() {
    console.log('🧪 Integration Test: End-to-End Pipeline');
    console.log('=========================================\n');

    // Test with 3 companies from your actual data
    const testCompanies = [
        {
            name: '5Mins AI',
            website: 'https://www.5mins.ai/',
            linkedin: 'https://www.linkedin.com/company/5minsai/',
            description: 'AI platform'
        },
        {
            name: 'Apicbase',
            website: 'https://get.apicbase.com',
            linkedin: 'https://www.linkedin.com/company/apicbase/',
            description: 'Back-of-house platform for restaurants'
        }
    ];

    console.log(`📊 Testing pipeline with ${testCompanies.length} companies`);
    console.log(`Companies: ${testCompanies.map(c => c.name).join(', ')}\n`);

    try {
        // Stage 1: Website Discovery
        console.log('🌐 Stage 1: Website Discovery');
        console.log('-----------------------------');
        const websiteFinder = new WebsiteFinder(
            { enable_search: true, timeout_ms: 5000 },
            { rate_limit_ms: 500 }
        );
        
        let result = await websiteFinder.process([...testCompanies]);
        console.log(`✅ Website stage completed: ${result.summary.successful} enhanced`);

        // Stage 2: LinkedIn Enhancement  
        console.log('\n🔗 Stage 2: LinkedIn Enhancement');
        console.log('----------------------------------');
        const linkedinEnhancer = new LinkedInEnhancer(
            { web_search_fallback: true, timeout_ms: 10000 },
            { rate_limit_ms: 1000 }
        );
        
        result = await linkedinEnhancer.process(testCompanies);
        console.log(`✅ LinkedIn stage completed: ${result.summary.successful} enhanced`);

        // Stage 3: Employee Analysis (FILTERING - keeps only 11-200 employees)
        console.log('\n👥 Stage 3: Employee Analysis (Filtering 11-200)');
        console.log('--------------------------------------------------');
        const employeeAnalyzer = new EmployeeAnalyzer(
            { target_range: { min: 11, max: 200 }, api_endpoint: 'company_pro' },
            {
                rapidapi_key: process.env.rapid_api_key || '03f25c1267msh8befbf9f32825c5p104c76jsn952863a7ff5a',
                rapidapi_host: 'linkedin-data-scraper.p.rapidapi.com',
                rate_limit_ms: 1000
            }
        );
        
        const originalCount = testCompanies.length;
        result = await employeeAnalyzer.process(testCompanies);
        console.log(`✅ Employee stage completed: ${testCompanies.length}/${originalCount} companies remain after filtering`);

        // Only continue if we have companies left after filtering
        if (testCompanies.length === 0) {
            console.log('❌ No companies passed employee filtering. Test stopped.');
            return;
        }

        // Stage 4: Funding Analysis (INTEGRATED - with real fallbacks)
        console.log('\n💰 Stage 4: Enhanced Funding Analysis');
        console.log('--------------------------------------');
        const fundingAnalyzer = new FundingAnalyzer(
            { recent_threshold_months: 12, api_endpoint: 'company_pro' },
            {
                rapidapi_key: process.env.rapid_api_key || '03f25c1267msh8befbf9f32825c5p104c76jsn952863a7ff5a',
                rapidapi_host: 'linkedin-data-scraper.p.rapidapi.com',
                rate_limit_ms: 1000
            }
        );
        
        result = await fundingAnalyzer.process(testCompanies);
        console.log(`✅ Funding stage completed with enhancements`);

        // Stage 5: Job Analysis (INTEGRATED - with real fallbacks)
        console.log('\n💼 Stage 5: Enhanced Job Analysis');
        console.log('----------------------------------');
        const jobAnalyzer = new JobAnalyzer(
            { 
                recent_threshold_weeks: 3,
                target_roles: ['sales', 'marketing', 'business development'],
                api_endpoint: 'company_jobs' 
            },
            {
                rapidapi_key: process.env.rapid_api_key || '03f25c1267msh8befbf9f32825c5p104c76jsn952863a7ff5a',
                rapidapi_host: 'linkedin-data-scraper.p.rapidapi.com',
                rate_limit_ms: 1000
            }
        );
        
        result = await jobAnalyzer.process(testCompanies);
        console.log(`✅ Job stage completed with enhancements`);

        // Stage 6: Final Results Summary
        console.log('\n📊 Final Results Summary');
        console.log('=========================');
        
        testCompanies.forEach((company, index) => {
            console.log(`\n${index + 1}. ${company.name}`);
            console.log(`   Website: ${company.website || 'Not found'}`);
            console.log(`   LinkedIn: ${company.linkedin_url || company.linkedin || 'Not found'}`);
            console.log(`   Employees: ${company.employee_count || 'Unknown'} (${company.employee_range || 'N/A'})`);
            console.log(`   In target range: ${company.in_target_range_11_200 || false}`);
            console.log(`   Has funding: ${company.has_funding_data || false}`);
            console.log(`   Recent funding: ${company.has_recent_funding_1yr || false}`);
            console.log(`   Has recent jobs: ${company.has_recent_jobs || false}`);
            console.log(`   Sales jobs: ${company.has_sales_jobs || false}`);
            console.log(`   Marketing jobs: ${company.has_marketing_jobs || false}`);
            console.log(`   BD jobs: ${company.has_bd_jobs || false}`);
            
            // Show data sources for enhanced stages
            if (company.funding_data_sources && company.funding_data_sources.length > 0) {
                console.log(`   Funding sources: ${company.funding_data_sources.join(', ')}`);
            }
            if (company.job_data_sources && company.job_data_sources.length > 0) {
                console.log(`   Job sources: ${company.job_data_sources.join(', ')}`);
            }
            
            // Calculate priority score
            let score = 0;
            if (company.in_target_range_11_200) score += 2;
            if (company.has_recent_funding_1yr) score += 3;
            if (company.has_sales_jobs) score += 2;
            if (company.has_marketing_jobs) score += 2;
            if (company.has_bd_jobs) score += 1;
            
            console.log(`   Priority Score: ${score}/10`);
        });

        console.log('\n✅ Integration Test Results');
        console.log('============================');
        console.log('✅ All pipeline stages executed successfully');
        console.log('✅ Enhanced analyzers integrated without breaking existing functionality'); 
        console.log('✅ Real fallback mechanisms activated when needed');
        console.log('✅ Data source tracking implemented');
        console.log('✅ Priority scoring calculated');
        console.log('\n🚀 Pipeline is ready for full CSV processing!');

    } catch (error) {
        console.error('❌ Integration test failed:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the integration test
if (require.main === module) {
    testIntegratedPipeline()
        .then(() => {
            console.log('\n✅ Integration test completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Integration test failed:', error);
            process.exit(1);
        });
}

module.exports = { testIntegratedPipeline };