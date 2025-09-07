#!/usr/bin/env node

/**
 * Multi-Expo Processing Pipeline
 * Automated company enrichment and analysis pipeline
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');

// Import pipeline modules (will be created)
const LinkedInEnhancer = require('./modules/linkedin-enhancer');
const EmployeeAnalyzer = require('./modules/employee-analyzer');
const FundingAnalyzer = require('./modules/funding-analyzer');
const JobAnalyzer = require('./modules/job-analyzer');
const Consolidator = require('./modules/consolidator');

class ExpoPipeline {
    constructor(configPath) {
        this.config = this.loadConfig(configPath);
        this.results = new Map();
        this.startTime = Date.now();
        this.currentStage = '';
    }

    loadConfig(configPath) {
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }
        
        const configContent = fs.readFileSync(configPath, 'utf8');
        let config = JSON.parse(configContent);
        
        // Replace environment variables
        const configStr = JSON.stringify(config);
        const resolvedStr = configStr.replace(/\$\{(\w+)\}/g, (match, varName) => {
            return process.env[varName] || match;
        });
        
        return JSON.parse(resolvedStr);
    }

    async run(inputFile, resumeFrom = null) {
        console.log(chalk.blue.bold(`\n🚀 EXPO PIPELINE: ${this.config.expo_name}`));
        console.log(chalk.gray('='.repeat(60)));
        
        try {
            // Load input data
            const companies = await this.loadInputData(inputFile);
            console.log(chalk.green(`✅ Loaded ${companies.length} companies`));
            
            // Run pipeline stages
            const stages = this.getPipelineStages(resumeFrom);
            
            for (const stage of stages) {
                await this.runStage(stage, companies);
            }
            
            // Generate final output
            const outputFile = await this.generateOutput(companies);
            
            // Generate summary report
            this.generateSummaryReport(companies, outputFile);
            
            console.log(chalk.green.bold(`\n🎉 Pipeline completed successfully!`));
            console.log(chalk.yellow(`📄 Results: ${outputFile}`));
            
        } catch (error) {
            console.error(chalk.red.bold(`❌ Pipeline failed: ${error.message}`));
            throw error;
        }
    }

    async loadInputData(inputFile) {
        // Implementation will load CSV and validate required columns
        return []; // Placeholder
    }

    getPipelineStages(resumeFrom) {
        const allStages = [
            { name: 'linkedin_enhancement', module: LinkedInEnhancer },
            { name: 'employee_analysis', module: EmployeeAnalyzer },
            { name: 'funding_analysis', module: FundingAnalyzer },
            { name: 'job_analysis', module: JobAnalyzer }
        ];

        if (resumeFrom) {
            const resumeIndex = allStages.findIndex(stage => stage.name === resumeFrom);
            if (resumeIndex === -1) {
                throw new Error(`Invalid resume stage: ${resumeFrom}`);
            }
            return allStages.slice(resumeIndex);
        }

        return allStages.filter(stage => this.config.stages[stage.name]?.enabled);
    }

    async runStage(stage, companies) {
        this.currentStage = stage.name;
        const stageConfig = this.config.stages[stage.name];
        
        console.log(chalk.blue(`\n🔄 Running stage: ${stage.name.toUpperCase()}`));
        console.log(chalk.gray(`   Configuration: ${JSON.stringify(stageConfig, null, 2).slice(0, 100)}...`));
        
        const analyzer = new stage.module(stageConfig, this.config.api_settings);
        const results = await analyzer.process(companies);
        
        this.results.set(stage.name, results);
        
        // Save intermediate results
        this.saveIntermediateResults(stage.name, companies);
        
        console.log(chalk.green(`✅ Stage completed: ${stage.name}`));
    }

    saveIntermediateResults(stageName, companies) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `results/${this.config.expo_name.toLowerCase().replace(/\s+/g, '_')}_${stageName}_${timestamp}.csv`;
        
        // Create results directory if it doesn't exist
        if (!fs.existsSync('results')) {
            fs.mkdirSync('results', { recursive: true });
        }
        
        // Save CSV (implementation needed)
        console.log(chalk.gray(`   💾 Intermediate results saved: ${filename}`));
    }

    async generateOutput(companies) {
        const consolidator = new Consolidator(this.config.output);
        const outputFile = await consolidator.generate(companies, this.results, this.config.expo_name);
        return outputFile;
    }

    generateSummaryReport(companies, outputFile) {
        const totalTime = (Date.now() - this.startTime) / 1000 / 60; // minutes
        
        console.log(chalk.blue.bold(`\n📊 PROCESSING SUMMARY`));
        console.log(chalk.gray('='.repeat(40)));
        console.log(`📋 Total companies processed: ${companies.length}`);
        console.log(`⏱️  Total processing time: ${totalTime.toFixed(1)} minutes`);
        console.log(`📁 Output file: ${outputFile}`);
        
        // Stage-specific summaries
        for (const [stageName, results] of this.results.entries()) {
            if (results && results.summary) {
                console.log(`\n${stageName.toUpperCase()}:`);
                console.log(`   Success rate: ${results.summary.successRate}%`);
                console.log(`   Qualified companies: ${results.summary.qualifiedCount}`);
            }
        }
    }
}

// CLI Setup
program
    .version('1.0.0')
    .description('Multi-Expo Processing Pipeline');

program
    .command('run')
    .description('Run the processing pipeline')
    .requiredOption('-c, --config <file>', 'Configuration file path')
    .requiredOption('-i, --input <file>', 'Input CSV file path')
    .option('-r, --resume <stage>', 'Resume from specific stage')
    .action(async (options) => {
        try {
            const pipeline = new ExpoPipeline(options.config);
            await pipeline.run(options.input, options.resume);
        } catch (error) {
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

program
    .command('init')
    .description('Initialize new expo configuration')
    .requiredOption('-n, --name <name>', 'Expo name')
    .option('-t, --template <file>', 'Template config file', 'configs/template.json')
    .action((options) => {
        // Create new config from template
        const template = JSON.parse(fs.readFileSync(options.template, 'utf8'));
        template.expo_name = options.name;
        
        const configFile = `configs/${options.name.toLowerCase().replace(/\s+/g, '_')}.json`;
        fs.writeFileSync(configFile, JSON.stringify(template, null, 2));
        
        console.log(chalk.green(`✅ Created configuration: ${configFile}`));
        console.log(chalk.yellow(`📝 Edit the configuration file before running the pipeline`));
    });

// Handle CLI execution
if (require.main === module) {
    program.parse();
}

module.exports = ExpoPipeline;