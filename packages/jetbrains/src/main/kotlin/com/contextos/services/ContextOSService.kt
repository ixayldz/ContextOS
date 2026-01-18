package com.contextos.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import java.io.BufferedReader
import java.io.InputStreamReader
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection

/**
 * Context build result
 */
data class BuildResult(
    val fileCount: Int,
    val tokenCount: Int,
    val context: String
)

/**
 * Analysis result
 */
data class AnalysisResult(
    val summary: String,
    val findings: List<String>,
    val suggestions: List<String>
)

/**
 * Doctor report
 */
data class DoctorReport(
    val passed: Int,
    val warnings: Int,
    val errors: Int,
    val issues: List<String>
)

/**
 * ContextOS Service
 * Interfaces with CLI to provide ContextOS functionality
 */
@Service(Service.Level.PROJECT)
class ContextOSService(private val project: Project) {
    
    private var currentContext: String? = null
    private var lastBuildResult: BuildResult? = null
    
    companion object {
        fun getInstance(project: Project): ContextOSService {
            return project.getService(ContextOSService::class.java)
        }
    }
    
    /**
     * Build context for a goal
     */
    fun buildContext(goal: String): BuildResult {
        val output = runCtxCommand("goal", goal)
        
        // Parse output to extract file count and token count
        val fileCountMatch = Regex("""(\d+) files""").find(output)
        val tokenCountMatch = Regex("""(\d+) tokens""").find(output)
        
        val result = BuildResult(
            fileCount = fileCountMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0,
            tokenCount = tokenCountMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0,
            context = output
        )
        
        currentContext = output
        lastBuildResult = result
        
        return result
    }
    
    /**
     * Copy current context to clipboard
     */
    fun copyToClipboard() {
        val context = currentContext ?: throw IllegalStateException("No context available")
        
        val selection = StringSelection(context)
        Toolkit.getDefaultToolkit().systemClipboard.setContents(selection, selection)
    }
    
    /**
     * Check if context is available
     */
    fun hasContext(): Boolean = currentContext != null
    
    /**
     * Run RLM analysis
     */
    fun analyze(query: String): AnalysisResult {
        val output = runCtxCommand("analyze", query)
        
        // Parse output
        return AnalysisResult(
            summary = output.lines().firstOrNull() ?: "",
            findings = output.lines().filter { it.startsWith("- ") },
            suggestions = output.lines().filter { it.startsWith("💡") }
        )
    }
    
    /**
     * Show analysis result in tool window
     */
    fun showAnalysisResult(result: AnalysisResult) {
        // TODO: Integrate with tool window
    }
    
    /**
     * Run doctor health check
     */
    fun runDoctor(): DoctorReport {
        val output = runCtxCommand("doctor")
        
        // Parse output
        val passedMatch = Regex("""(\d+) passed""").find(output)
        val warningsMatch = Regex("""(\d+) warnings?""").find(output)
        val errorsMatch = Regex("""(\d+) errors?""").find(output)
        
        val issues = output.lines()
            .filter { it.contains("⚠") || it.contains("❌") }
            .map { it.trim() }
        
        return DoctorReport(
            passed = passedMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0,
            warnings = warningsMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0,
            errors = errorsMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0,
            issues = issues
        )
    }
    
    /**
     * Get current context
     */
    fun getCurrentContext(): String? = currentContext
    
    /**
     * Get last build result
     */
    fun getLastBuildResult(): BuildResult? = lastBuildResult
    
    /**
     * Run ctx CLI command
     */
    private fun runCtxCommand(vararg args: String): String {
        val projectPath = project.basePath ?: throw IllegalStateException("No project path")
        
        val process = ProcessBuilder("ctx", *args)
            .directory(java.io.File(projectPath))
            .redirectErrorStream(true)
            .start()
        
        val output = BufferedReader(InputStreamReader(process.inputStream))
            .readText()
        
        val exitCode = process.waitFor()
        
        if (exitCode != 0) {
            throw RuntimeException("ctx command failed: $output")
        }
        
        return output
    }
}
