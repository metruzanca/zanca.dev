import React from "react"

import {BlogGlobalStyle} from '../../style'

import {ReadingDiv} from './style'

import Navigation from '../Navbar'

const scrollableSections = [
  {
    name:"Home",
    path:"/#home",
  },
  {
    name:"Projects",
    path:"/#projects",
  },
  {
    name:"About",
    path:"/#about",
  },
  {
    name:"Contact",
    path:"/#contact",
  }
]

const additionalSections = [
  {
    name:"Blog",
    path:"/blog",
  },
]

const BlogLayout = ({ location, title, children }) => {
  //@ts-ignore Gatsby Environment Variable
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath + 'blog'
  
  return (
    <>
      <BlogGlobalStyle/>
      <Navigation
        scrollableSections={scrollableSections}
        additionalSections={additionalSections}
        highlight={scrollableSections.length} // first section + 1 as /blog is the first 
      />
      <ReadingDiv>
        <main>{children}</main>
        {/* <footer>
          © {new Date().getFullYear()}, Built with
          {` `}
          <a href="https://www.gatsbyjs.com">Gatsby</a>
        </footer> */}
      </ReadingDiv>
    </>
  )
}

export default BlogLayout
