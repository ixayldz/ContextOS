/**
 * Tests for regex-based multi-language parser
 */

import { describe, it, expect } from 'vitest';
import {
    extractImportsRegex,
    extractExportsRegex,
    extractFunctionsRegex,
    extractClassesRegex,
    parseWithRegex,
    isLanguageSupported,
    getSupportedLanguages,
} from '../src/parser/regex-parser.js';

describe('Regex Parser', () => {
    describe('TypeScript', () => {
        it('should extract ES6 imports', () => {
            const code = `
import { foo, bar } from './module';
import type { MyType } from './types';
import * as utils from 'utils';
import defaultExport from 'package';
            `;

            const imports = extractImportsRegex(code, 'typescript');
            expect(imports.length).toBeGreaterThanOrEqual(3);
            expect(imports.some(i => i.source === './module')).toBe(true);
            expect(imports.some(i => i.type === 'type-import')).toBe(true);
        });

        it('should extract functions', () => {
            const code = `
export async function fetchData() {}
function privateFunc() {}
const arrowFunc = () => {};
export const exportedArrow = async () => {};
            `;

            const functions = extractFunctionsRegex(code, 'typescript');
            expect(functions).toContain('fetchData');
            expect(functions).toContain('privateFunc');
        });

        it('should extract classes', () => {
            const code = `
export class UserService {}
class InternalClass extends BaseClass {}
class GenericClass implements Interface {}
            `;

            const classes = extractClassesRegex(code, 'typescript');
            expect(classes).toContain('UserService');
            expect(classes).toContain('InternalClass');
            expect(classes).toContain('GenericClass');
        });
    });

    describe('Python', () => {
        it('should extract imports', () => {
            const code = `
import os
import sys
from typing import List, Dict
from django.http import HttpResponse
from . import local_module
            `;

            const imports = extractImportsRegex(code, 'python');
            expect(imports.length).toBeGreaterThanOrEqual(3);
            expect(imports.some(i => i.source === 'os')).toBe(true);
            expect(imports.some(i => i.source === 'typing')).toBe(true);
        });

        it('should extract functions', () => {
            const code = `
def sync_function():
    pass

async def async_function():
    pass

def another_func(arg1, arg2):
    return arg1 + arg2
            `;

            const functions = extractFunctionsRegex(code, 'python');
            expect(functions).toContain('sync_function');
            expect(functions).toContain('async_function');
            expect(functions).toContain('another_func');
        });

        it('should extract classes', () => {
            const code = `
class MyClass:
    pass

class DerivedClass(BaseClass):
    pass
            `;

            const classes = extractClassesRegex(code, 'python');
            expect(classes).toContain('MyClass');
            expect(classes).toContain('DerivedClass');
        });
    });

    describe('Go', () => {
        it('should extract imports', () => {
            const code = `
package main

import "fmt"
import log "log"
import (
    "net/http"
    "encoding/json"
    "github.com/gin-gonic/gin"
)
            `;

            const imports = extractImportsRegex(code, 'go');
            expect(imports.length).toBeGreaterThanOrEqual(2);
            expect(imports.some(i => i.source === 'fmt')).toBe(true);
        });

        it('should extract functions', () => {
            const code = `
func main() {
    fmt.Println("Hello")
}

func (s *Server) HandleRequest(w http.ResponseWriter, r *http.Request) {
}

func privateFunc() int {
    return 42
}
            `;

            const functions = extractFunctionsRegex(code, 'go');
            expect(functions).toContain('main');
            expect(functions).toContain('HandleRequest');
            expect(functions).toContain('privateFunc');
        });

        it('should extract structs and interfaces', () => {
            const code = `
type User struct {
    ID   int
    Name string
}

type Repository interface {
    Find(id int) *User
    Save(user *User) error
}
            `;

            const classes = extractClassesRegex(code, 'go');
            expect(classes).toContain('User');
            expect(classes).toContain('Repository');
        });
    });

    describe('Rust', () => {
        it('should extract imports', () => {
            const code = `
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
extern crate tokio;
mod config;
            `;

            const imports = extractImportsRegex(code, 'rust');
            expect(imports.length).toBeGreaterThanOrEqual(2);
            expect(imports.some(i => i.source.includes('std::collections'))).toBe(true);
        });

        it('should extract functions', () => {
            const code = `
pub fn public_function() {}
fn private_function() -> i32 { 42 }
pub async fn async_handler() {}
fn generic<T>(item: T) {}
            `;

            const functions = extractFunctionsRegex(code, 'rust');
            expect(functions).toContain('public_function');
            expect(functions).toContain('private_function');
            expect(functions).toContain('async_handler');
        });

        it('should extract structs, enums, traits', () => {
            const code = `
pub struct User {
    name: String,
}

pub enum Status {
    Active,
    Inactive,
}

pub trait Repository {
    fn find(&self, id: i32) -> Option<User>;
}
            `;

            const classes = extractClassesRegex(code, 'rust');
            expect(classes).toContain('User');
            expect(classes).toContain('Status');
            expect(classes).toContain('Repository');
        });
    });

    describe('Java', () => {
        it('should extract imports', () => {
            const code = `
package com.example;

import java.util.List;
import java.util.ArrayList;
import static java.lang.Math.*;
import org.springframework.boot.SpringApplication;
            `;

            const imports = extractImportsRegex(code, 'java');
            expect(imports.length).toBeGreaterThanOrEqual(3);
            expect(imports.some(i => i.source.includes('java.util.List'))).toBe(true);
        });

        it('should extract classes and interfaces', () => {
            const code = `
public class UserController {
    public void handleRequest() {}
}

public interface UserRepository {
    User findById(Long id);
}

public enum UserStatus {
    ACTIVE, INACTIVE
}
            `;

            const classes = extractClassesRegex(code, 'java');
            expect(classes).toContain('UserController');
            expect(classes).toContain('UserRepository');
            expect(classes).toContain('UserStatus');
        });
    });

    describe('Utility functions', () => {
        it('should report supported languages', () => {
            expect(isLanguageSupported('typescript')).toBe(true);
            expect(isLanguageSupported('python')).toBe(true);
            expect(isLanguageSupported('go')).toBe(true);
            expect(isLanguageSupported('rust')).toBe(true);
            expect(isLanguageSupported('java')).toBe(true);
            expect(isLanguageSupported('cobol')).toBe(false);
        });

        it('should list all supported languages', () => {
            const languages = getSupportedLanguages();
            expect(languages).toContain('typescript');
            expect(languages).toContain('go');
            expect(languages).toContain('rust');
            expect(languages.length).toBeGreaterThanOrEqual(6);
        });

        it('should parse full file', () => {
            const code = `
import { Service } from './service';

export class Controller {
    constructor(private service: Service) {}
}

export function main() {}
            `;

            const result = parseWithRegex(code, 'typescript');
            expect(result.imports.length).toBeGreaterThanOrEqual(1);
            expect(result.classes).toContain('Controller');
            expect(result.functions).toContain('main');
        });
    });
});
