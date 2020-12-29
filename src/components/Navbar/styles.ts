import styled from 'styled-components'
// import { Link } from "gatsby"

import {theme, Link, HeadingCSS} from '../../style'

// Logo(ZbestDev)      Nav[Home, Projects, Services, About, Contact, Blog]     Social[Linkedin, GitHub, Resume]

export const Nav = styled.header`
  display: inline;
  display: grid;
  grid-template-columns: 2fr 5fr 2fr;
  height:80px;
  background-color: rgba(0, 0, 0, .2);
  //TODO make this centering MUCH better
  padding:25px 20px;
`

export const NavLogo = styled.span`
  ${HeadingCSS}
/*TODO Remove this color: white thing */
  & > a, & > a:visited {
    color: white;
  }
  grid-column: 1;
`

export const NavNav = styled.nav`
  grid-column: 2;
`
export const NavSocial = styled.span`
  grid-column: 3;
`

export const Ul = styled.ul`
  display: inline;
  text-decoration: none;
  padding: 0;
  margin: 0;
`

export const Li = styled.li`
  display: inline;
  padding: 0 20px 0 0;
`

export const NavLink = styled(Link)`
  text-decoration: none;
  &:hover{
    color: ${theme.fg.accent};
  }
`
