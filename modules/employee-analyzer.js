/**
 * Employee Count Analysis Module
 * Analyzes company employee counts and flags companies in target range
 */

const axios = require('axios');

class EmployeeAnalyzer {
    constructor(stageConfig, apiSettings) {
        this.config = stageConfig;
        this.api = apiSettings;
        this.results = {
            processed: 0,
            successful: 0,
            inTargetRange: 0,
            errors: []
        };
    }

    async process(companies) {
        console.log(`   📊 Analyzing employee counts for ${companies.length} companies...`);
        console.log(`   🎯 FILTERING companies with ${this.config.target_range.min}-${this.config.target_range.max} employees`);
        console.log(`   ⚠️  NOTE: Only companies in target range will be kept`);
        
        const results = [];
        const filteredCompanies = [];
        
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            
            console.log(`   [${i + 1}/${companies.length}] ${company.name || 'Unknown'}`);
            
            try {
                const employeeData = await this.getEmployeeCountWithRetry(company);
                
                // Add employee data to company
                company.employee_count = employeeData.employee_count;
                company.employee_range = employeeData.employee_range;
                company.in_target_range_11_200 = employeeData.in_target_range_11_200;
                company.employee_data_source = employeeData.employee_data_source;
                
                this.results.processed++;
                if (employeeData.api_success) {
                    this.results.successful++;
                }
                
                // FILTER: Only keep companies in target range
                if (employeeData.in_target_range_11_200) {
                    this.results.inTargetRange++;
                    filteredCompanies.push(company);
                    console.log(`     ✅ KEPT - In target range`);
                } else {
                    console.log(`     ❌ FILTERED OUT - Not in target range`);
                }
                
                results.push(employeeData);
                
                // Rate limiting (reduced to 1 second)
                if (i < companies.length - 1) {
                    await this.delay(1000);
                }
                
            } catch (error) {
                console.log(`     ❌ Error after retries: ${error.message}`);
                
                // Don't keep companies with errors when filtering
                company.employee_count = null;
                company.employee_range = null;
                company.in_target_range_11_200 = false;
                company.employee_data_source = `Error: ${error.message}`;
                
                this.results.errors.push({ company: company.name, error: error.message });
            }
        }
        
        // Replace companies array with filtered list
        companies.length = 0;
        companies.push(...filteredCompanies);
        
        console.log(`\n   🎯 Filtered from ${companies.length + filteredCompanies.length} to ${filteredCompanies.length} companies`);
        
        this.generateSummary();
        return {
            results: results,
            summary: this.getSummary(),
            filteredCount: filteredCompanies.length,
            originalCount: companies.length + filteredCompanies.length
        };
    }

    async getEmployeeCountWithRetry(company, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            return await this.getEmployeeCount(company);
        } catch (error) {
            // Check if it's a rate limit error (429) and we have retries left
            if (error.response && error.response.status === 429 && retryCount < maxRetries) {
                const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
                console.log(`     ⏳ Rate limited. Retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await this.delay(backoffDelay);
                return this.getEmployeeCountWithRetry(company, retryCount + 1);
            }
            throw error;
        }
    }

    async getEmployeeCount(company) {
        if (!company.linkedin_url && !company.linkedin) {
            throw new Error('No LinkedIn URL available');
        }

        const linkedinUrl = company.linkedin_url || company.linkedin;
        
        const options = {
            method: 'POST',
            url: `https://${this.api.rapidapi_host}/${this.config.api_endpoint}`,
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': this.api.rapidapi_key,
                'X-RapidAPI-Host': this.api.rapidapi_host
            },
            data: {
                link: linkedinUrl
            }
        };

        const response = await axios.request(options);
        const data = response.data.data || response.data;

        // Extract employee information
        const employeeCount = this.extractEmployeeCount(data);
        const employeeRange = this.extractEmployeeRange(data);
        
        // Determine if in target range
        const inTargetRange = this.isInTargetRange(employeeCount, employeeRange);
        
        // Generate evidence
        const evidence = this.generateEvidence(employeeCount, employeeRange, data);
        
        console.log(`     👥 ${employeeCount || 'Unknown'} employees - ${inTargetRange ? '✅ IN RANGE' : '❌ OUT OF RANGE'}`);
        
        return {
            api_success: true,
            employee_count: employeeCount,
            employee_range: employeeRange,
            in_target_range_11_200: inTargetRange,
            employee_data_source: evidence,
            raw_employee_data: {
                employeeCount: data.employeeCount,
                employeeCountRange: data.employeeCountRange,
                employeesOnLinkedIn: data.employeesOnLinkedIn
            },
            error: null
        };
    }

    extractEmployeeCount(data) {
        // Try multiple possible fields
        return data.employeeCount || 
               data.employee_count || 
               data.employeesCount || 
               null;
    }

    extractEmployeeRange(data) {
        if (data.employeeCountRange) {
            if (typeof data.employeeCountRange === 'string') {
                return data.employeeCountRange;
            }
            if (data.employeeCountRange.start && data.employeeCountRange.end) {
                return `${data.employeeCountRange.start}-${data.employeeCountRange.end}`;
            }
        }
        return data.employee_range || data.employeeRange || null;
    }

    isInTargetRange(employeeCount, employeeRange) {
        const min = this.config.target_range.min;
        const max = this.config.target_range.max;
        
        // Check exact count first
        if (employeeCount && !isNaN(parseInt(employeeCount))) {
            const count = parseInt(employeeCount);
            return count >= min && count <= max;
        }
        
        // Check range if available
        if (employeeRange && typeof employeeRange === 'string') {
            const rangeMatch = employeeRange.match(/(\d+)-(\d+)/);
            if (rangeMatch) {
                const rangeStart = parseInt(rangeMatch[1]);
                const rangeEnd = parseInt(rangeMatch[2]);
                
                // Check if ranges overlap
                return (rangeStart <= max && rangeEnd >= min);
            }
            
            // Check for ranges like "11-50 employees"
            const employeeMatch = employeeRange.match(/(\d+)-(\d+)\s*employees?/i);
            if (employeeMatch) {
                const rangeStart = parseInt(employeeMatch[1]);
                const rangeEnd = parseInt(employeeMatch[2]);
                return (rangeStart <= max && rangeEnd >= min);
            }
        }
        
        return false;
    }

    generateEvidence(employeeCount, employeeRange, rawData) {
        const evidence = [];
        
        if (employeeCount) {
            evidence.push(`Exact count: ${employeeCount}`);
        }
        
        if (employeeRange) {
            evidence.push(`Range: ${employeeRange}`);
        }
        
        if (rawData.employeesOnLinkedIn) {
            evidence.push(`LinkedIn employees: ${rawData.employeesOnLinkedIn}`);
        }
        
        return evidence.join(' | ');
    }

    generateSummary() {
        const successRate = this.results.processed > 0 
            ? ((this.results.successful / this.results.processed) * 100).toFixed(1)
            : 0;
            
        console.log(`\n   📊 Employee Analysis Summary:`);
        console.log(`      Processed: ${this.results.processed} companies`);
        console.log(`      API Success: ${this.results.successful} (${successRate}%)`);
        console.log(`      In Target Range: ${this.results.inTargetRange}`);
        console.log(`      Errors: ${this.results.errors.length}`);
    }

    getSummary() {
        return {
            processed: this.results.processed,
            successful: this.results.successful,
            successRate: this.results.processed > 0 
                ? ((this.results.successful / this.results.processed) * 100).toFixed(1)
                : 0,
            qualifiedCount: this.results.inTargetRange,
            errorCount: this.results.errors.length
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = EmployeeAnalyzer;