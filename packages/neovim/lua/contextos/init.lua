-- ContextOS Neovim Plugin
-- The Context Server Protocol for AI Coding
-- Version: 0.1.0

local M = {}

-- Plugin configuration
M.config = {
    -- Path to ctx CLI
    ctx_path = "ctx",
    
    -- Auto-index on save
    auto_index = false,
    
    -- Target model for token budgeting
    target_model = "gpt-4-turbo",
    
    -- Keymaps
    keymaps = {
        build = "<leader>cb",      -- Build context
        copy = "<leader>cc",       -- Copy context
        analyze = "<leader>ca",    -- Analyze
        preview = "<leader>cp",    -- Preview
    },
    
    -- UI options
    ui = {
        border = "rounded",
        width = 80,
        height = 20,
    },
}

-- State
M.state = {
    current_context = nil,
    last_goal = nil,
    initialized = false,
}

-- Setup function
function M.setup(opts)
    M.config = vim.tbl_deep_extend("force", M.config, opts or {})
    
    -- Check if ctx is available
    local handle = io.popen(M.config.ctx_path .. " --version 2>&1")
    if handle then
        local result = handle:read("*a")
        handle:close()
        if result:match("ctx") or result:match("ContextOS") then
            M.state.initialized = true
        end
    end
    
    -- Register commands
    M._register_commands()
    
    -- Register keymaps
    M._register_keymaps()
    
    -- Setup autocommands if auto_index enabled
    if M.config.auto_index then
        vim.api.nvim_create_autocmd("BufWritePost", {
            pattern = "*",
            callback = function()
                M.index_incremental()
            end,
        })
    end
end

-- Register user commands
function M._register_commands()
    vim.api.nvim_create_user_command("ContextOSBuild", function(args)
        M.build(args.args)
    end, { nargs = "?", desc = "Build context for goal" })
    
    vim.api.nvim_create_user_command("ContextOSCopy", function()
        M.copy()
    end, { desc = "Copy context to clipboard" })
    
    vim.api.nvim_create_user_command("ContextOSAnalyze", function(args)
        M.analyze(args.args)
    end, { nargs = "?", desc = "Analyze codebase" })
    
    vim.api.nvim_create_user_command("ContextOSPreview", function()
        M.preview()
    end, { desc = "Preview current context" })
    
    vim.api.nvim_create_user_command("ContextOSDoctor", function()
        M.doctor()
    end, { desc = "Run health check" })
    
    vim.api.nvim_create_user_command("ContextOSIndex", function()
        M.index()
    end, { desc = "Index project" })
end

-- Register keymaps
function M._register_keymaps()
    local keymaps = M.config.keymaps
    
    if keymaps.build then
        vim.keymap.set("n", keymaps.build, function()
            M.build_interactive()
        end, { desc = "ContextOS: Build Context" })
    end
    
    if keymaps.copy then
        vim.keymap.set("n", keymaps.copy, function()
            M.copy()
        end, { desc = "ContextOS: Copy Context" })
    end
    
    if keymaps.analyze then
        vim.keymap.set("n", keymaps.analyze, function()
            M.analyze_interactive()
        end, { desc = "ContextOS: Analyze" })
    end
    
    if keymaps.preview then
        vim.keymap.set("n", keymaps.preview, function()
            M.preview()
        end, { desc = "ContextOS: Preview" })
    end
end

-- Build context for a goal
function M.build(goal)
    if not goal or goal == "" then
        goal = M.state.last_goal
    end
    
    if not goal or goal == "" then
        vim.notify("No goal specified", vim.log.levels.WARN)
        return
    end
    
    M.state.last_goal = goal
    
    vim.notify("Building context for: " .. goal, vim.log.levels.INFO)
    
    local cmd = M.config.ctx_path .. " goal " .. vim.fn.shellescape(goal)
    local result = vim.fn.system(cmd)
    
    if vim.v.shell_error ~= 0 then
        vim.notify("Build failed: " .. result, vim.log.levels.ERROR)
        return
    end
    
    M.state.current_context = result
    vim.notify("Context built successfully!", vim.log.levels.INFO)
end

-- Interactive build with input prompt
function M.build_interactive()
    vim.ui.input({ prompt = "Goal: " }, function(goal)
        if goal and goal ~= "" then
            M.build(goal)
        end
    end)
end

-- Copy context to clipboard
function M.copy()
    if not M.state.current_context then
        vim.notify("No context available. Run :ContextOSBuild first.", vim.log.levels.WARN)
        return
    end
    
    vim.fn.setreg("+", M.state.current_context)
    vim.fn.setreg("*", M.state.current_context)
    
    local lines = #vim.split(M.state.current_context, "\n")
    vim.notify("Copied " .. lines .. " lines to clipboard", vim.log.levels.INFO)
end

-- Analyze codebase
function M.analyze(query)
    if not query or query == "" then
        vim.notify("No query specified", vim.log.levels.WARN)
        return
    end
    
    vim.notify("Analyzing: " .. query, vim.log.levels.INFO)
    
    local cmd = M.config.ctx_path .. " analyze " .. vim.fn.shellescape(query)
    local result = vim.fn.system(cmd)
    
    if vim.v.shell_error ~= 0 then
        vim.notify("Analysis failed: " .. result, vim.log.levels.ERROR)
        return
    end
    
    -- Show result in floating window
    M._show_floating_window("Analysis Result", result)
end

-- Interactive analyze with input prompt
function M.analyze_interactive()
    vim.ui.input({ prompt = "Analysis Query: " }, function(query)
        if query and query ~= "" then
            M.analyze(query)
        end
    end)
end

-- Preview current context
function M.preview()
    if not M.state.current_context then
        vim.notify("No context available. Run :ContextOSBuild first.", vim.log.levels.WARN)
        return
    end
    
    M._show_floating_window("Context Preview", M.state.current_context)
end

-- Run doctor health check
function M.doctor()
    vim.notify("Running health check...", vim.log.levels.INFO)
    
    local cmd = M.config.ctx_path .. " doctor"
    local result = vim.fn.system(cmd)
    
    M._show_floating_window("Health Check", result)
end

-- Index project
function M.index()
    vim.notify("Indexing project...", vim.log.levels.INFO)
    
    local cmd = M.config.ctx_path .. " index"
    local result = vim.fn.system(cmd)
    
    if vim.v.shell_error ~= 0 then
        vim.notify("Index failed: " .. result, vim.log.levels.ERROR)
    else
        vim.notify("Indexing complete!", vim.log.levels.INFO)
    end
end

-- Incremental index
function M.index_incremental()
    local cmd = M.config.ctx_path .. " index --incremental"
    vim.fn.jobstart(cmd, {
        on_exit = function(_, code)
            if code == 0 then
                vim.notify("Index updated", vim.log.levels.DEBUG)
            end
        end,
    })
end

-- Show floating window with content
function M._show_floating_window(title, content)
    local ui = M.config.ui
    
    -- Create buffer
    local buf = vim.api.nvim_create_buf(false, true)
    
    -- Set content
    local lines = vim.split(content, "\n")
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
    
    -- Set buffer options
    vim.api.nvim_buf_set_option(buf, "modifiable", false)
    vim.api.nvim_buf_set_option(buf, "buftype", "nofile")
    vim.api.nvim_buf_set_option(buf, "filetype", "markdown")
    
    -- Calculate window size
    local width = math.min(ui.width, vim.o.columns - 4)
    local height = math.min(ui.height, vim.o.lines - 4)
    local row = math.floor((vim.o.lines - height) / 2)
    local col = math.floor((vim.o.columns - width) / 2)
    
    -- Create window
    local win = vim.api.nvim_open_win(buf, true, {
        relative = "editor",
        width = width,
        height = height,
        row = row,
        col = col,
        style = "minimal",
        border = ui.border,
        title = " " .. title .. " ",
        title_pos = "center",
    })
    
    -- Set window options
    vim.api.nvim_win_set_option(win, "wrap", true)
    
    -- Keymaps to close window
    vim.keymap.set("n", "q", function()
        vim.api.nvim_win_close(win, true)
    end, { buffer = buf })
    
    vim.keymap.set("n", "<Esc>", function()
        vim.api.nvim_win_close(win, true)
    end, { buffer = buf })
end

return M
