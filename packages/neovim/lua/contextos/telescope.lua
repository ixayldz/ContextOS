-- ContextOS Telescope Integration
-- Provides fuzzy finding for files, goals, and more

local M = {}

local has_telescope, telescope = pcall(require, "telescope")
if not has_telescope then
    return M
end

local pickers = require("telescope.pickers")
local finders = require("telescope.finders")
local conf = require("telescope.config").values
local actions = require("telescope.actions")
local action_state = require("telescope.actions.state")

-- Find files with ContextOS context scoring
M.context_files = function(opts)
    opts = opts or {}
    
    local contextos = require("contextos")
    local ctx_path = contextos.config.ctx_path
    
    -- Get ranked files from ctx
    local cmd = ctx_path .. " preview --format json 2>/dev/null"
    local handle = io.popen(cmd)
    local result = handle:read("*a")
    handle:close()
    
    local files = {}
    local ok, data = pcall(vim.fn.json_decode, result)
    
    if ok and data and data.files then
        for _, file in ipairs(data.files) do
            table.insert(files, {
                path = file.path,
                score = file.score or 0,
                reason = file.reason or "",
            })
        end
    else
        -- Fallback to regular file list
        return require("telescope.builtin").find_files(opts)
    end
    
    pickers.new(opts, {
        prompt_title = "ContextOS Files",
        finder = finders.new_table({
            results = files,
            entry_maker = function(entry)
                return {
                    value = entry,
                    display = string.format("%.2f %s", entry.score, entry.path),
                    ordinal = entry.path,
                    path = entry.path,
                }
            end,
        }),
        sorter = conf.generic_sorter(opts),
        previewer = conf.file_previewer(opts),
        attach_mappings = function(prompt_bufnr, map)
            actions.select_default:replace(function()
                actions.close(prompt_bufnr)
                local selection = action_state.get_selected_entry()
                vim.cmd("edit " .. selection.path)
            end)
            return true
        end,
    }):find()
end

-- Search recent goals
M.goals = function(opts)
    opts = opts or {}
    
    local contextos = require("contextos")
    local ctx_path = contextos.config.ctx_path
    
    -- Get recent goals from training data
    local cmd = ctx_path .. " finetune recent --limit 20 2>/dev/null"
    local handle = io.popen(cmd)
    local result = handle:read("*a")
    handle:close()
    
    local goals = {}
    for line in result:gmatch("[^\n]+") do
        local goal = line:match("Goal: (.+)")
        if goal then
            table.insert(goals, goal)
        end
    end
    
    if #goals == 0 then
        vim.notify("No recent goals found", vim.log.levels.INFO)
        return
    end
    
    pickers.new(opts, {
        prompt_title = "Recent Goals",
        finder = finders.new_table({
            results = goals,
        }),
        sorter = conf.generic_sorter(opts),
        attach_mappings = function(prompt_bufnr, _)
            actions.select_default:replace(function()
                actions.close(prompt_bufnr)
                local selection = action_state.get_selected_entry()
                contextos.build(selection[1])
            end)
            return true
        end,
    }):find()
end

-- Search symbols with dependencies
M.symbols = function(opts)
    opts = opts or {}
    
    local contextos = require("contextos")
    local ctx_path = contextos.config.ctx_path
    local current_file = vim.fn.expand("%:p")
    
    -- Get dependencies for current file
    local cmd = ctx_path .. " trace " .. vim.fn.shellescape(current_file) .. " 2>/dev/null"
    local handle = io.popen(cmd)
    local result = handle:read("*a")
    handle:close()
    
    local symbols = {}
    for line in result:gmatch("[^\n]+") do
        if line:match("^%s*[%w_]+") then
            table.insert(symbols, line:gsub("^%s+", ""))
        end
    end
    
    if #symbols == 0 then
        return require("telescope.builtin").lsp_document_symbols(opts)
    end
    
    pickers.new(opts, {
        prompt_title = "ContextOS Symbols",
        finder = finders.new_table({
            results = symbols,
        }),
        sorter = conf.generic_sorter(opts),
    }):find()
end

-- Register Telescope extension
local function register()
    telescope.register_extension({
        exports = {
            context_files = M.context_files,
            goals = M.goals,
            symbols = M.symbols,
        },
    })
end

-- Auto-register if telescope is loaded
if has_telescope then
    register()
end

return M
