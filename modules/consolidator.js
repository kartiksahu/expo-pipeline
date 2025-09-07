/**
 * Consolidator Module
 * Generates final CSV with all enrichment data and flags
 */

const fs = require('fs');
const path = require('path');

class Consolidator {
    constructor(outputConfig) {
        this.config = outputConfig;
    }

    async generate(companies, stageResults, expoName) {
        console.log(`   📊 Generating final consolidated CSV...`);
        
        // Calculate priority scores
        companies.forEach(company => {
            company.priority_score = this.calculatePriorityScore(company);
            company.processing_date = new Date().toISOString();
            company.processing_notes = this.generateProcessingNotes(company);
        });
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const cleanExpoName = expoName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const filename = path.join('results', `${cleanExpoName}_processed_${timestamp}.csv`);
        
        // Create CSV content
        const csvContent = this.generateCSV(companies);
        
        // Write file
        fs.writeFileSync(filename, csvContent);
        
        console.log(`   ✅ Final CSV generated: ${filename}`);
        console.log(`   📊 ${companies.length} companies with complete enrichment data`);
        
        return filename;
    }

    calculatePriorityScore(company) {
        let score = 0;
        
        // Employee range bonus (companies in our target range)
        if (company.in_target_range_11_200 === true || company.in_target_range_11_200 === 'TRUE') {
            score += 2;
        }
        
        // Funding bonuses
        if (company.has_funding_data === true || company.has_funding_data === 'TRUE') {
            score += 1;
        }
        if (company.has_recent_funding_1yr === true || company.has_recent_funding_1yr === 'TRUE') {
            score += 2;
        }
        
        // Job posting bonuses
        if (company.has_recent_jobs === true || company.has_recent_jobs === 'TRUE') {
            score += 1;
        }
        if (company.has_sales_jobs === true || company.has_sales_jobs === 'TRUE') {
            score += 2;
        }
        if (company.has_marketing_jobs === true || company.has_marketing_jobs === 'TRUE') {
            score += 1;
        }
        if (company.has_bd_jobs === true || company.has_bd_jobs === 'TRUE') {
            score += 1;
        }
        
        // LinkedIn URL bonus
        if (company.linkedin_url && company.linkedin_url.trim() !== '') {
            score += 1;
        }
        
        return score;
    }

    generateProcessingNotes(company) {
        const notes = [];
        
        // LinkedIn source
        if (company.linkedin_source) {
            if (company.linkedin_source === 'website') {
                notes.push('LinkedIn found via website');
            } else if (company.linkedin_source === 'web_search') {
                notes.push('LinkedIn found via web search');
            } else if (company.linkedin_source === 'existing') {
                notes.push('LinkedIn already present');
            } else if (company.linkedin_source === 'not_found') {
                notes.push('LinkedIn not found');
            }
        }
        
        // Data quality issues
        if (!company.website || company.website.trim() === '') {
            notes.push('No website');
        }
        
        if (!company.linkedin_url || company.linkedin_url.trim() === '') {
            notes.push('No LinkedIn URL');
        }
        
        return notes.join('; ');
    }

    generateCSV(companies) {
        if (companies.length === 0) {
            return 'No data';
        }
        
        // Get all possible headers from all companies
        const allHeaders = new Set();
        companies.forEach(company => {
            Object.keys(company).forEach(key => allHeaders.add(key));
        });
        
        // Define preferred column order
        const priorityColumns = [
            'name', 'companyName', 'website', 'linkedin_url', 'linkedin_source',
            'description', 'industry', 'employee_count', 'in_target_range_11_200',
            'has_funding_data', 'has_recent_funding_1yr', 'funding_details',
            'has_recent_jobs', 'has_sales_jobs', 'has_marketing_jobs', 'has_bd_jobs',
            'priority_score', 'processing_date', 'processing_notes'
        ];
        
        // Columns to exclude from final output (to avoid confusion)
        const excludeColumns = [
            'linkedin',  // Original column, we use linkedin_url instead
            'LinkedIn',  // Original column variant
            'LinkedIn URL',  // Original column variant
            'LinkedIn url',  // Original column variant
            'linkedin_original'  // Internal tracking field
        ];
        
        // Create ordered headers
        const orderedHeaders = [];
        
        // Add priority columns first
        priorityColumns.forEach(col => {
            if (allHeaders.has(col)) {
                orderedHeaders.push(col);
                allHeaders.delete(col);
            }
        });
        
        // Add remaining columns (excluding the ones we want to hide)
        const remainingHeaders = Array.from(allHeaders)
            .filter(col => !excludeColumns.includes(col))
            .sort();
        orderedHeaders.push(...remainingHeaders);
        
        // Generate CSV header
        const csvHeader = orderedHeaders.join(',');
        
        // Generate CSV rows
        const csvRows = companies.map(company => {
            return orderedHeaders.map(header => {
                const value = company[header];
                
                // Handle various data types
                if (value === null || value === undefined) {
                    return '';
                }
                
                if (typeof value === 'boolean') {
                    return value.toString().toUpperCase();
                }
                
                if (typeof value === 'object') {
                    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                }
                
                // String handling with proper CSV escaping
                const stringValue = String(value);
                
                // If the string contains commas, quotes, or newlines, wrap in quotes and escape quotes
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                
                return stringValue;
            }).join(',');
        });
        
        return [csvHeader, ...csvRows].join('\n');
    }
}

module.exports = Consolidator;