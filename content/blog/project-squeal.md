---
title: Project Squeal
description: TODO
timestamp: 2026-06-15T10:51:45
tags:
  - terminal
  - rust
  - databases
canonical_url: https://zanca.dev/blog/project-squeal
publish: false
---

Today we're going to be talking about Squeal, a little weekend project I started to solve a problem I had.

A little back story: I used to be a big VS Code user for many years and I loved the extensions because you could have everything in the same app. For example I would use a Database Viewer extension inside a VS Code. But recently I moved to the Zed editor, which I am starting to fall in love with, However one side effect is that the extension support is quite limited at the moment. And one of the limitations is that you cannot make custom views. So a database viewer extension is out of the question at the moment. However I've been building a bunch of Terminal apps as of late, Mostly in Node and Golang, And since I recently started to write almost exclusively in Rust, I decided it was time to try and make a ratatui-based app. This way I could have my Database viewer lives in my Zed terminal And I could get pretty close to the ideal workflow That I had from VS Code.

I've been writing Rust for a few weeks using a couple of different side projects as learning grounds. I think the most beneficial learning came from starting a codecrafter project, specifically building my own shell, as well as working my way through the Rustlings exercise book. So I feel pretty confident reading and writing most Intermediate rust. Of course there's things that I am still very scared to touch, like anything to do with complex macro internals, Lifetimes and pointers since I've come from mostly pointer-less languages like JavaScript. Luckily though, from what I saw, all of the frameworks like Ratatouille, Axiom, GPUI all abstract away most of these problems so I don't really have to touch them very much. I can just jump straight in and have fun.

## Ratatui

I hadn't tried Ratatui before this project but I've heard many good things from YouTubers, shitposters on X, and a good friend of mine also from X, Aster. I knew this was a great framework.

My goal for this project was to solve my problem and to not waste too much time on it.

My side projects use SQLite for the database for convenience and for a very small footprint So the main database I wanted to support was SQLite. What I needed from squeal was to be able to view table structure and data, I kept running into issues where my production database was behind, usually because AI generated a migration with an out of order timestamp and so it never got run. To complicate matters I tend to deploy my projects on Railway so I don't have access to the SQLite file locally (its on a docker volume on the server). So I would like to have something that I can install on a server very quickly. A small Rust TUI application is a perfect fit.

## Squeal

Now to talk about Squeal! Squeal is a TUI application, Very much inspired by the likes of HTOP, nano, opencode, terminal.shop. Squeal uses the alternate screen approach, which means that whenever you open the application, it switches out the buffer of the terminal so that when you quit, it goes back to whatever you had on your terminal before, Instead of the approach of clearing the terminal Screen and drawing on it, Something you might do in a CLI.

The usage of Squeal is pretty simple by design. You just pass it the sqlite file or a Postgres connection string and it should just show you the tables and you should be able to view the contents. The controls should be intuitive and support many different ways of interacting with the app Such as arrow keys and VIM hjkl support. I wanted a very uncomplicated experience.
