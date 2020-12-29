import React from "react"

import {Highlight} from '../../style'
import {Observed} from "../ObservedSection"

import {HeroSection, HeroHeading, HeroParagraph, CallToAction} from './styles'

interface Props {
}

const Hero: React.FC<Props> = ({
}) => {

  return (
      <HeroSection>
        <HeroHeading>
          Hello, I'm <Highlight>Samuele Zanca</Highlight>
          <br/>
          a Full-Stack Developer
        </HeroHeading>
        <HeroParagraph>
          Some clever professional description that describes me but isn't also boring AF as this will be the first thing they see.
        </HeroParagraph>
        <CallToAction>
          Previous Work
        </CallToAction>
      </HeroSection>
  )
}

export default Observed(Hero);
