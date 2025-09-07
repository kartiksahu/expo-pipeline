#!/usr/bin/env node

/**
 * Fix has_recent_jobs column in processed CSV file
 * Sets has_recent_jobs to true if company has sales/marketing/BD jobs
 */

const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

const inputFile = '/Users/kksahu/Desktop/processed_1757156431257_2025-09-06T11-31-07.csv';
const outputFile = '/Users/kksahu/Desktop/processed_1757156431257_2025-09-06T11-31-07_FIXED.csv';

async function fixRecentJobs() {
    console.log('📊 Reading CSV file...');
    
    // Read the CSV file
    const companies = [];
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(inputFile)
            .pipe(csv())
            .on('data', (row) => {
                companies.push(row);
            })
            .on('end', async () => {
                console.log(`📋 Loaded ${companies.length} companies`);
                
                let updatedCount = 0;
                let totalWithTargetJobs = 0;
                
                // Apply the new logic
                companies.forEach(company => {
                    const originalValue = company.has_recent_jobs;
                    
                    // Convert string values to boolean for comparison
                    const hasSales = (company.has_sales_jobs === 'true' || company.has_sales_jobs === true);
                    const hasMarketing = (company.has_marketing_jobs === 'true' || company.has_marketing_jobs === true);
                    const hasBD = (company.has_bd_jobs === 'true' || company.has_bd_jobs === true);
                    
                    // Apply new logic: has_recent_jobs = true if ANY target role jobs are present
                    const newValue = hasSales || hasMarketing || hasBD;
                    
                    if (newValue) {
                        totalWithTargetJobs++;
                    }
                    
                    // Update the value
                    if (originalValue !== newValue.toString()) {
                        company.has_recent_jobs = newValue.toString();
                        updatedCount++;
                    } else {
                        company.has_recent_jobs = newValue.toString();
                    }
                });
                
                console.log(`🔄 Updated ${updatedCount} companies`);
                console.log(`✅ ${totalWithTargetJobs} companies now have has_recent_jobs = true`);
                
                // Get all headers from the original data
                const headers = Object.keys(companies[0]);
                
                // Create CSV writer
                const csvWriter = createObjectCsvWriter({
                    path: outputFile,
                    header: headers.map(key => ({ id: key, title: key }))
                });
                
                // Write the updated data
                await csvWriter.writeRecords(companies);
                
                console.log(`💾 Updated file saved as: ${outputFile}`);
                console.log('\n📊 Summary:');
                console.log(`   Total companies: ${companies.length}`);
                console.log(`   Companies with target role jobs: ${totalWithTargetJobs}`);
                console.log(`   Companies with sales jobs: ${companies.filter(c => c.has_sales_jobs === 'true').length}`);
                console.log(`   Companies with marketing jobs: ${companies.filter(c => c.has_marketing_jobs === 'true').length}`);
                console.log(`   Companies with BD jobs: ${companies.filter(c => c.has_bd_jobs === 'true').length}`);
                
                resolve();
            })
            .on('error', reject);
    });
}

// Run the fix
fixRecentJobs()
    .then(() => {
        console.log('\n✅ Job completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });