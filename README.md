# this is standpoint

---

_an atechnology company project_

## Imagine this

You have a set of things, and you want to show how much you like each item with your friends. What do you do?

You go over to Tiermaker, spend like 20 minutes collecting all the photos to download them to your computer, then upload them to the site, and then by the time you’ve finished doing all of that, your friends are all gone, you’re feeling demotivated, you’ve wasted 20 minutes and literally don’t want to do anything.

Okay, lets say that in the very limited repository of tier lists, Tiermaker actually already has one from it’s extremely dead community, you make your own copy, but it doesnt have everything you want, it also doesn’t have the look you want and the pictures are either wrong or theres no text so you don’t really know what you’re ranking or the other 50 problems that you may have.

Every single person born in the age of the New Internet can relate to this, and I think we all agree that this needs to change in the form of a new implementation and I’m here for it.

I want to make an app that people actually find useful and fun, that is made with modern day technology for a modern age of people that do want a purpose-built tool that is expressive and doesn’t look like it stopped evolving since 2012. I also want to make sure that its done in the most efficient, beautiful manner that exceeds your expectations on every open, something that goes against design norms to create a piece of art in an user interface that is fun to use.

Standpoint is a platform built for the New Internet centered around sharing opinions and creating tierlists. AI-powered, blazing quick and literally just my school project.

### note

one day im going to have to pay for a bunch of gemini api credits and then im going to cry a lot.

## standpoint is made with

- svelte
- tailwindcss
- sanic
- pydantic
- gemini 2.5 flash lite
- google image search api
- firebase

# run dev server

- pnpm dev
- source src-sanic/bin/activate && python3 src-sanic/main.py

### v0.1.1

- added proper tier list viewing
- revised backend to work with posting tierlists
- revised google images fetching to work with this project
- seperated sidebars for tierlist and polls

### v0.1.2

- fixed tierlist creations
  - converting dynamic to classic tierlists
  - scrolling for more images in image search
  - resizable items

### v0.1.3

- redesigned add modal with animations
- ai suggestions for tierlists with images
- simplified drag and drop logic

### v0.2

- firebase integrations
- authentication and tierlist ownership
- updated to gemini 2.5 flash lite (from 2.0 flash)
- added banner images
- renaming tierlists now renames the title of the webpage
- other minor refinements, fixes and improvements

## todo

- ai features -- fixed but need to fix google image api rate limits (use a dedicated image provider) (ok google images just doesnt work on any app o_o) -- i actually have no idea what im going to do about this
- **add and implement firebase auth with usergroups -- in progress**
- **add firebase functionality to saving tierlists and polls -- in progress**
  - make profile pages
  - fix and test firebase uploading tierlists images and etc

  
- add feed -- dependent on auth
- create onboarding
- create mainpage -- talking about the platform what it is and what it does
- add options for banner and background images for tierlists and poll display in lists
- add poll suggestion input, no creating polls unless youre a dev
- draft autosaving functionality
- make a mobile version
- add animations
- add pro plan with stripe for customisation options
  - ability to customise accent
  - backgrounds?
  - change fonts
  - animations on profile pictures and names
  - special voting animations (super reactions)
  - profile badges
- add blockchain
- tierlist nfts
- revamp the comment system | self documenting code
- refine ui to look more fluid and alternative

- ~~on rename tier list rename the title of the webpage~~
- ability to change type of an item after adding it
- fix click to add positioning
- ~~fix header formatting on tier list creation~~
- ~~give ability to sign in while creating a tier list~~
- open tier list to non signed in users but not publish
