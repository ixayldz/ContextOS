package com.contextos.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.InputValidator
import com.contextos.services.ContextOSService
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType

/**
 * Build Context Action
 * Opens a dialog to enter a goal and builds optimized context
 */
class BuildContextAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        val goal = Messages.showInputDialog(
            project,
            "Enter your development goal:",
            "Build Context",
            Messages.getQuestionIcon(),
            "",
            object : InputValidator {
                override fun checkInput(inputString: String) = inputString.isNotBlank()
                override fun canClose(inputString: String) = inputString.isNotBlank()
            }
        ) ?: return
        
        buildContext(project, goal)
    }
    
    private fun buildContext(project: Project, goal: String) {
        val service = ContextOSService.getInstance(project)
        
        try {
            val result = service.buildContext(goal)
            
            NotificationGroupManager.getInstance()
                .getNotificationGroup("ContextOS")
                .createNotification(
                    "Context Built",
                    "Built context with ${result.fileCount} files (${result.tokenCount} tokens)",
                    NotificationType.INFORMATION
                )
                .notify(project)
                
        } catch (ex: Exception) {
            NotificationGroupManager.getInstance()
                .getNotificationGroup("ContextOS")
                .createNotification(
                    "Context Build Failed",
                    ex.message ?: "Unknown error",
                    NotificationType.ERROR
                )
                .notify(project)
        }
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}

/**
 * Copy Context Action
 * Copies the current context to clipboard
 */
class CopyContextAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = ContextOSService.getInstance(project)
        
        try {
            service.copyToClipboard()
            
            NotificationGroupManager.getInstance()
                .getNotificationGroup("ContextOS")
                .createNotification(
                    "Context Copied",
                    "Context copied to clipboard",
                    NotificationType.INFORMATION
                )
                .notify(project)
                
        } catch (ex: Exception) {
            Messages.showErrorDialog(
                project,
                ex.message ?: "Failed to copy context",
                "Copy Failed"
            )
        }
    }
    
    override fun update(e: AnActionEvent) {
        val project = e.project
        val service = project?.let { ContextOSService.getInstance(it) }
        e.presentation.isEnabledAndVisible = service?.hasContext() == true
    }
}

/**
 * Analyze Action
 * Runs RLM-powered deep analysis
 */
class AnalyzeAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        
        val query = Messages.showInputDialog(
            project,
            "Enter analysis query:",
            "RLM Analysis",
            Messages.getQuestionIcon(),
            "",
            null
        ) ?: return
        
        val service = ContextOSService.getInstance(project)
        
        try {
            val result = service.analyze(query)
            
            // Show result in tool window
            service.showAnalysisResult(result)
            
        } catch (ex: Exception) {
            Messages.showErrorDialog(
                project,
                ex.message ?: "Analysis failed",
                "Analysis Error"
            )
        }
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}

/**
 * Doctor Action  
 * Runs health check on ContextOS configuration
 */
class DoctorAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = ContextOSService.getInstance(project)
        
        try {
            val report = service.runDoctor()
            
            val message = buildString {
                appendLine("Health Check Results:")
                appendLine()
                appendLine("✅ Passed: ${report.passed}")
                appendLine("⚠️ Warnings: ${report.warnings}")
                appendLine("❌ Errors: ${report.errors}")
                
                if (report.issues.isNotEmpty()) {
                    appendLine()
                    appendLine("Issues:")
                    report.issues.forEach { issue ->
                        appendLine("  - $issue")
                    }
                }
            }
            
            Messages.showInfoMessage(project, message, "ContextOS Health Check")
            
        } catch (ex: Exception) {
            Messages.showErrorDialog(
                project,
                ex.message ?: "Health check failed",
                "Doctor Error"
            )
        }
    }
    
    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}
