#!/usr/bin/env node

/**
 * Clean CSV Generator
 * Extracts only essential columns for outreach from the processed pipeline output
 */

const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

function cleanJobTitles(jobTitles) {
    if (!jobTitles || jobTitles.length === 0) return '';
    
    // Comprehensive HTML/JavaScript/Code cleanup
    let cleanText = jobTitles
        // Remove HTML tags completely
        .replace(/<[^>]*>/gi, ' ')
        // Remove script/style content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        // Remove JavaScript patterns
        .replace(/\bfunction\s*\([^)]*\)\s*\{[^}]*\}/gi, '')
        .replace(/\bjQuery\b.*$/gi, '')
        .replace(/\$\([^)]*\)[^;]*;?/gi, '')
        .replace(/\bwindow\.[^;]*;?/gi, '')
        .replace(/\bdocument\.[^;]*;?/gi, '')
        .replace(/\bconsole\.[^;]*;?/gi, '')
        // Remove common web code patterns
        .replace(/\biframe\b[^>]*>/gi, '')
        .replace(/\bdata-[a-z-]+="[^"]*"/gi, '')
        .replace(/\bclass="[^"]*"/gi, '')
        .replace(/\bid="[^"]*"/gi, '')
        .replace(/\bstyle="[^"]*"/gi, '')
        // Remove URLs and email patterns that might be embedded
        .replace(/https?:\/\/[^\s]+/gi, '')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '')
        // Remove brackets and braces with their content if they look like code
        .replace(/\{[^}]*\}/gi, ' ')
        .replace(/\[[^\]]*\]/gi, ' ')
        // Clean up whitespace and special characters
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s,.-]/gi, ' ')
        .trim();
    
    // If heavily contaminated with code (still long after cleaning), extract job keywords
    if (cleanText.length > 300 || jobTitles.includes('<') || jobTitles.includes('jQuery') || jobTitles.includes('function')) {
        // Extract job-related terms using refined patterns
        const jobKeywords = [
            // Sales roles
            'Sales Manager', 'Account Executive', 'Account Manager', 'Sales Representative', 'Sales Director',
            'Business Development', 'Sales Specialist', 'Inside Sales', 'Outside Sales', 'Territory Manager',
            'Commercial Manager', 'Sales Coordinator', 'Key Account Manager', 'Regional Sales Manager',
            
            // Marketing roles
            'Marketing Manager', 'Marketing Director', 'Digital Marketing', 'Content Marketing', 'Brand Manager',
            'Marketing Specialist', 'Growth Marketing', 'Product Marketing', 'Marketing Coordinator',
            'Social Media Manager', 'Marketing Analyst', 'Demand Generation', 'Campaign Manager',
            
            // Business Development
            'Business Development Manager', 'BD Manager', 'Partnership Manager', 'Strategic Partnerships',
            'Alliance Manager', 'Channel Manager', 'Corporate Development', 'Business Development Representative',
            
            // General business roles
            'Project Manager', 'Operations Manager', 'Customer Success', 'Account Coordinator',
            'Business Analyst', 'Product Manager', 'Strategy Manager', 'Director'
        ];
        
        let foundRoles = [];
        const lowerText = cleanText.toLowerCase();
        
        jobKeywords.forEach(keyword => {
            if (lowerText.includes(keyword.toLowerCase())) {
                foundRoles.push(keyword);
            }
        });
        
        // Remove duplicates and limit to 3 most relevant
        foundRoles = [...new Set(foundRoles)].slice(0, 3);
        
        if (foundRoles.length > 0) {
            return foundRoles.join('; ');
        } else {
            // Try to extract any role-like words if specific keywords not found
            const roleWords = cleanText.match(/\b(Manager|Director|Specialist|Coordinator|Executive|Representative|Analyst|Developer|Engineer|Consultant|Lead|Senior|Junior)\b/gi);
            if (roleWords && roleWords.length > 0) {
                const uniqueRoles = [...new Set(roleWords.slice(0, 3))];
                return `${uniqueRoles.join(', ')} roles available`;
            }
        }
        
        return 'Current openings available - see company website';
    }
    
    // For cleaner text, just trim and limit length
    return cleanText.substring(0, 150).trim() || 'Contact company for current openings';
}

function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/[\r\n\t]+/g, ' ')  // Remove line breaks and tabs
        .replace(/"/g, '""')  // Escape quotes for CSV
        .replace(/\s+/g, ' ')  // Clean multiple spaces
        .trim()
        .substring(0, 500); // Reasonable limit
}

function cleanAddress(address) {
    if (!address) return '';
    
    // If address looks like a company description (too long), truncate or clean
    if (address.length > 200 || address.includes('specialized') || address.includes('innovation')) {
        // Try to extract just location info
        const locationPatterns = [
            /([A-Z][a-z]+,\s*[A-Z]{2}\s*\d{5})/,  // City, State ZIP
            /([A-Z][a-z]+,\s*[A-Z]{2})/,  // City, State
            /(\d+\s+[^,]+,\s*[A-Z][a-z]+)/,  // Address, City
            /([A-Z][a-z]+,\s*[A-Z][a-z]+)/  // City, Country
        ];
        
        for (const pattern of locationPatterns) {
            const match = address.match(pattern);
            if (match) {
                return cleanText(match[0]);
            }
        }
        
        // If no location pattern found, return truncated version
        return cleanText(address.substring(0, 100) + '...');
    }
    
    return cleanText(address);
}

function escapeCsvValue(value) {
    if (!value && value !== 0) return '';
    
    const stringValue = String(value)
        .replace(/[\r\n\t]+/g, ' ')  // Remove line breaks completely
        .replace(/\s+/g, ' ')  // Clean multiple spaces
        .trim();
    
    // If value contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
}

async function processCSV(inputFile) {
    const results = [];
    const outputFile = inputFile.replace('.csv', '_CLEAN_FOR_OUTREACH.csv');
    
    console.log('🧹 Cleaning CSV for outreach...');
    console.log(`📂 Input: ${inputFile}`);
    console.log(`📤 Output: ${outputFile}`);
    
    return new Promise((resolve, reject) => {
        fs.createReadStream(inputFile)
            .pipe(csv())
            .on('data', (row) => {
                // Extract only essential outreach columns
                const cleanRow = {
                    // Company Information
                    'Company_Name': cleanText(row['Company Name'] || row['name'] || ''),
                    'Website': cleanText(row['website'] || row['Website'] || ''),
                    'LinkedIn': cleanText(row['linkedin_url'] || row['LinkedIn'] || ''),
                    'Phone': cleanText(row['Phone'] || ''),
                    'Address': cleanAddress(row['Address'] || ''),
                    'Booth_Number': cleanText(row['Booth Number'] || ''),
                    
                    // Company Size & Fit
                    'Employee_Count': row['employee_count'] || '',
                    'Employee_Range': row['employee_range'] || '',
                    'In_Target_Size': row['in_target_range_11_200'] || '',
                    
                    // Funding Status (for prioritization)
                    'Has_Funding': row['has_funding_data'] || 'false',
                    'Recent_Funding_1yr': row['has_recent_funding_1yr'] || 'false',
                    'Funding_Details': cleanText(row['funding_details'] || ''),
                    'Last_Funding_Date': cleanText(row['last_funding_date'] || ''),
                    'Total_Funding': cleanText(row['total_funding'] || ''),
                    
                    // Job & Hiring Status (for timing)
                    'Currently_Hiring': row['has_recent_jobs'] || 'false',
                    'Has_Sales_Jobs': row['has_sales_jobs'] || 'false',
                    'Has_Marketing_Jobs': row['has_marketing_jobs'] || 'false',
                    'Has_BD_Jobs': row['has_bd_jobs'] || 'false',
                    'Job_Titles': cleanJobTitles(row['recent_job_titles'] || ''),
                    'Hiring_Urgency': row['hiring_urgency'] || 'None',
                    
                    // Data Quality
                    'Data_Confidence': Math.max(
                        parseFloat(row['funding_confidence'] || 0),
                        parseFloat(row['job_confidence'] || 0)
                    ).toFixed(1),
                    
                    // Outreach Priority Score
                    'Priority_Score': calculatePriorityScore(row),
                    
                    // Contact Information
                    'Key_Contacts': cleanText(row['Organization Members'] || ''),
                    'Profile_URLs': cleanText(row['Member Profile URLs'] || '')
                };
                
                results.push(cleanRow);
            })
            .on('end', async () => {
                console.log(`✅ Processed ${results.length} companies`);
                
                // Sort by priority score (highest first)
                results.sort((a, b) => parseFloat(b.Priority_Score) - parseFloat(a.Priority_Score));
                
                // Write CSV manually to ensure proper formatting
                const headers = [
                    'Company Name', 'Website', 'LinkedIn', 'Phone', 'Address', 'Booth Number', 
                    'Employees', 'Size Range', 'Priority Score', 'Has Funding', 'Recent Funding',
                    'Funding Details', 'Total Funding', 'Currently Hiring', 'Sales Roles', 
                    'Marketing Roles', 'BD Roles', 'Recent Job Openings', 'Hiring Urgency',
                    'Key Contacts', 'Contact URLs', 'Data Quality'
                ];
                
                let csvContent = headers.join(',') + '\n';
                
                results.forEach(row => {
                    const values = [
                        escapeCsvValue(row.Company_Name),
                        escapeCsvValue(row.Website),
                        escapeCsvValue(row.LinkedIn),
                        escapeCsvValue(row.Phone),
                        escapeCsvValue(row.Address),
                        escapeCsvValue(row.Booth_Number),
                        escapeCsvValue(row.Employee_Count),
                        escapeCsvValue(row.Employee_Range),
                        escapeCsvValue(row.Priority_Score),
                        escapeCsvValue(row.Has_Funding),
                        escapeCsvValue(row.Recent_Funding_1yr),
                        escapeCsvValue(row.Funding_Details),
                        escapeCsvValue(row.Total_Funding),
                        escapeCsvValue(row.Currently_Hiring),
                        escapeCsvValue(row.Has_Sales_Jobs),
                        escapeCsvValue(row.Has_Marketing_Jobs),
                        escapeCsvValue(row.Has_BD_Jobs),
                        escapeCsvValue(row.Job_Titles),
                        escapeCsvValue(row.Hiring_Urgency),
                        escapeCsvValue(row.Key_Contacts),
                        escapeCsvValue(row.Profile_URLs),
                        escapeCsvValue(row.Data_Confidence)
                    ];
                    csvContent += values.join(',') + '\n';
                });
                
                try {
                    fs.writeFileSync(outputFile, csvContent, 'utf8');
                    console.log(`🎉 Clean outreach CSV created: ${outputFile}`);
                    
                    // Generate summary
                    generateSummary(results, outputFile);
                    resolve(outputFile);
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', reject);
    });
}

function calculatePriorityScore(row) {
    let score = 50; // Base score
    
    // Company size (sweet spot: 50-150 employees)
    const empCount = parseInt(row['employee_count']) || 0;
    if (empCount >= 50 && empCount <= 150) score += 30;
    else if (empCount >= 20 && empCount <= 200) score += 20;
    else if (empCount >= 11 && empCount <= 300) score += 10;
    
    // Funding status (recent funding = higher priority)
    if (row['has_recent_funding_1yr'] === 'true') score += 25;
    else if (row['has_funding_data'] === 'true') score += 15;
    
    // Hiring status (currently hiring = higher priority)
    if (row['has_recent_jobs'] === 'true') score += 20;
    if (row['has_sales_jobs'] === 'true') score += 15;
    if (row['has_marketing_jobs'] === 'true') score += 10;
    if (row['has_bd_jobs'] === 'true') score += 10;
    
    // Data quality
    const confidence = Math.max(
        parseFloat(row['funding_confidence'] || 0),
        parseFloat(row['job_confidence'] || 0)
    );
    score += confidence * 10; // 0-10 points for data quality
    
    // Has key contact information
    if (row['Organization Members']) score += 5;
    if (row['Phone']) score += 5;
    
    return Math.min(100, score).toFixed(0); // Cap at 100
}

function generateSummary(results, outputFile) {
    const summary = {
        total_companies: results.length,
        high_priority: results.filter(r => parseFloat(r.Priority_Score) >= 80).length,
        medium_priority: results.filter(r => parseFloat(r.Priority_Score) >= 60 && parseFloat(r.Priority_Score) < 80).length,
        with_funding: results.filter(r => r.Has_Funding === 'true').length,
        recent_funding: results.filter(r => r.Recent_Funding_1yr === 'true').length,
        currently_hiring: results.filter(r => r.Currently_Hiring === 'true').length,
        sales_roles: results.filter(r => r.Has_Sales_Jobs === 'true').length,
        marketing_roles: results.filter(r => r.Has_Marketing_Jobs === 'true').length,
        with_contacts: results.filter(r => r.Key_Contacts.length > 0).length
    };
    
    console.log('\n📊 Outreach Summary:');
    console.log(`   Companies: ${summary.total_companies}`);
    console.log(`   High Priority (80+): ${summary.high_priority}`);
    console.log(`   Medium Priority (60-79): ${summary.medium_priority}`);
    console.log(`   With Funding: ${summary.with_funding}`);
    console.log(`   Recent Funding: ${summary.recent_funding}`);
    console.log(`   Currently Hiring: ${summary.currently_hiring}`);
    console.log(`   Sales Roles: ${summary.sales_roles}`);
    console.log(`   Marketing Roles: ${summary.marketing_roles}`);
    console.log(`   With Key Contacts: ${summary.with_contacts}`);
    
    // Write summary file
    const summaryFile = outputFile.replace('.csv', '_SUMMARY.txt');
    fs.writeFileSync(summaryFile, `
OUTREACH READY - CMTS 2025 COMPANIES
Generated: ${new Date().toISOString()}

📊 SUMMARY STATS:
• Total Companies: ${summary.total_companies}
• High Priority (80+): ${summary.high_priority}
• Medium Priority (60-79): ${summary.medium_priority}
• Currently Hiring: ${summary.currently_hiring}
• Recent Funding (1yr): ${summary.recent_funding}
• Sales Roles Open: ${summary.sales_roles}
• Marketing Roles Open: ${summary.marketing_roles}
• Have Key Contacts: ${summary.with_contacts}

🎯 OUTREACH STRATEGY:
1. Start with High Priority (80+) companies
2. Focus on companies with recent funding + hiring
3. Prioritize those with sales/marketing roles open
4. Use key contacts for personalized outreach

📁 FILES:
• Main Data: ${path.basename(outputFile)}
• Summary: ${path.basename(summaryFile)}
`);
    
    console.log(`📄 Summary saved: ${summaryFile}`);
}

// Main execution
async function main() {
    const inputFile = process.argv[2];
    
    if (!inputFile) {
        console.log('Usage: node clean-csv.js <input-csv-file>');
        console.log('Example: node clean-csv.js results/processed_123456789_2025-09-07T06-15-38.csv');
        process.exit(1);
    }
    
    if (!fs.existsSync(inputFile)) {
        console.error(`❌ File not found: ${inputFile}`);
        process.exit(1);
    }
    
    try {
        const outputFile = await processCSV(inputFile);
        console.log(`\n✅ Success! Clean outreach CSV ready: ${outputFile}`);
    } catch (error) {
        console.error('❌ Error processing CSV:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { processCSV, calculatePriorityScore };