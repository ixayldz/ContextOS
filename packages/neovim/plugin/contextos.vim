" ContextOS Neovim Plugin
" Bootstrap file for VimL compatibility

if exists('g:loaded_contextos')
    finish
endif
let g:loaded_contextos = 1

" Require Neovim
if !has('nvim-0.8')
    echohl ErrorMsg
    echom 'ContextOS requires Neovim 0.8 or later'
    echohl None
    finish
endif

" Load Lua module
lua require('contextos')
