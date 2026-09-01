//
// For guidance on how to add JavaScript see:
// https://prototype-kit.service.gov.uk/docs/adding-css-javascript-and-images
//

window.GOVUKPrototypeKit.documentReady(() => {
  initCypmdTopicAutocomplete()
  initCypmdGuidanceSearch()
  initCypmdGuidanceNavigation()
})

function initCypmdGuidanceNavigation () {
  const nav = document.getElementById('cypmd-guidance-nav')
  const sections = Array.from(document.querySelectorAll('.cypmd-guidance-section[id]'))

  if (!nav || !sections.length) return

  const links = Array.from(nav.querySelectorAll('a[href^="#"]'))

  function setActiveSection (id) {
    sections.forEach(function (section) {
      section.classList.toggle('cypmd-guidance-section--active', section.id === id)
    })

    links.forEach(function (link) {
      const isActive = link.getAttribute('href') === '#' + id
      const item = link.closest('.cypmd-guidance-nav-item')
      if (item) item.classList.toggle('moj-side-navigation__item--active', isActive)
      if (isActive) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    })
  }

  function scrollToSection (section, shouldFocus) {
    setActiveSection(section.id)
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (shouldFocus) {
      const heading = section.querySelector('h2')
      if (heading) {
        heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
      }
    }
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      const id = link.getAttribute('href').slice(1)
      const section = document.getElementById(id)
      if (!section) return

      event.preventDefault()
      window.history.pushState(null, '', '#' + id)
      scrollToSection(section, true)
    })
  })

  const initialId = window.location.hash.slice(1)
  const initialSection = document.getElementById(initialId)
  if (initialSection && initialSection.classList.contains('cypmd-guidance-section')) {
    setActiveSection(initialId)
  } else {
    setActiveSection(sections[0].id)
  }

  const observer = new window.IntersectionObserver(function (entries) {
    const visible = entries
      .filter(function (entry) { return entry.isIntersecting })
      .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top })

    if (visible.length) setActiveSection(visible[0].target.id)
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 })

  sections.forEach(function (section) { observer.observe(section) })
}

function initCypmdTopicAutocomplete () {
  const MIN_CHARS = 3
  const MAX_SUGGESTIONS = 5
  const form = document.querySelector('[data-module="cypmd-topic-autocomplete"]')

  if (!form) return

  const input = form.querySelector('#search')
  const list = form.querySelector('#cypmd-topic-suggestions')
  const status = document.getElementById('cypmd-search-results-status')
  let suggestions = []
  let activeIndex = -1

  function normalize (text) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  function getTopicItems () {
    const items = []

    document.querySelectorAll('.cypmd-guidance-section').forEach(function (section) {
      // Guidance pages use different GOV.UK heading sizes, so index the section's
      // h2 rather than relying on a particular heading-size class.
      const heading = section.querySelector('.cypmd-guidance-section__meta > h2')
      if (!heading) return

      const topic = heading.textContent.trim()
      const content = section.querySelector('.cypmd-guidance-section__meta > .govuk-body')
      const firstSummaryElement = content ? content.querySelector('p, li, dd') : null
      const summary = firstSummaryElement ? firstSummaryElement.textContent.trim() : topic
      items.push({ label: topic, summary: summary, searchText: normalize(section.textContent), target: heading })

      section.querySelectorAll('.cypmd-guidance-card').forEach(function (card) {
        const link = card.querySelector('.dfe-card-link--header')
        const description = card.querySelector('p')
        if (!link) return

        items.push({
          label: link.textContent.trim(),
          summary: description ? description.textContent.trim() : topic,
          searchText: normalize(link.textContent + ' ' + topic + ' ' + (description ? description.textContent : '')),
          target: card.querySelector('.govuk-heading-m') || link
        })
      })
    })

    return items
  }

  const topicItems = getTopicItems()

  function getSuggestions (query) {
    const normalizedQuery = normalize(query)
    if (normalizedQuery.length < MIN_CHARS) return []

    return topicItems.filter(function (item) {
      return item.searchText.indexOf(normalizedQuery) !== -1
    }).sort(function (a, b) {
      const aIndex = normalize(a.label).indexOf(normalizedQuery)
      const bIndex = normalize(b.label).indexOf(normalizedQuery)
      const aRank = aIndex === -1 ? 1000 : aIndex
      const bRank = bIndex === -1 ? 1000 : bIndex
      return aRank - bRank || a.label.localeCompare(b.label)
    }).slice(0, MAX_SUGGESTIONS)
  }

  function appendHighlightedText (element, text, query) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text.split(new RegExp('(' + escapedQuery + ')', 'ig')).forEach(function (fragment, index) {
      if (index % 2 === 1) {
        const strong = document.createElement('strong')
        strong.textContent = fragment
        element.appendChild(strong)
      } else {
        element.appendChild(document.createTextNode(fragment))
      }
    })
  }

  function closeSuggestions () {
    list.hidden = true
    list.replaceChildren()
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
    activeIndex = -1
  }

  function setActiveSuggestion (index) {
    activeIndex = index
    const options = list.querySelectorAll('[role="option"]')
    options.forEach(function (option, optionIndex) {
      const isActive = optionIndex === activeIndex
      option.setAttribute('aria-selected', isActive ? 'true' : 'false')
      option.classList.toggle('cypmd-autocomplete__suggestion--active', isActive)
    })

    if (activeIndex >= 0) input.setAttribute('aria-activedescendant', options[activeIndex].id)
    else input.removeAttribute('aria-activedescendant')
  }

  function selectSuggestion (suggestion) {
    input.value = suggestion.label
    closeSuggestions()
    suggestion.target.setAttribute('tabindex', '-1')
    suggestion.target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    suggestion.target.focus({ preventScroll: true })
    if (status) status.textContent = 'Showing ' + suggestion.label + (suggestion.summary ? '. ' + suggestion.summary : '')
  }

  function renderSuggestions () {
    const query = input.value.trim()
    suggestions = getSuggestions(query)
    activeIndex = -1
    list.replaceChildren()

    if (query.length < MIN_CHARS) {
      closeSuggestions()
      if (status && query.length) status.textContent = 'Enter ' + MIN_CHARS + ' or more characters to see guidance topics.'
      return
    }

    if (!suggestions.length) {
      closeSuggestions()
      if (status) status.textContent = 'No guidance topics found. Try different keywords.'
      return
    }

    suggestions.forEach(function (suggestion, index) {
      const option = document.createElement('li')
      const title = document.createElement('span')
      const topic = document.createElement('span')
      option.id = 'cypmd-topic-suggestion-' + index
      option.className = 'cypmd-autocomplete__suggestion'
      option.setAttribute('role', 'option')
      option.setAttribute('aria-selected', 'false')
      title.className = 'cypmd-autocomplete__suggestion-title'
      topic.className = 'cypmd-autocomplete__suggestion-topic'
      appendHighlightedText(title, suggestion.label, query)
      appendHighlightedText(topic, suggestion.summary || suggestion.label, query)
      option.appendChild(title)
      option.appendChild(topic)
      option.addEventListener('mousedown', function (event) {
        event.preventDefault()
        selectSuggestion(suggestion)
      })
      list.appendChild(option)
    })

    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    if (status) status.textContent = suggestions.length + (suggestions.length === 1 ? ' guidance topic is' : ' guidance topics are') + ' available. Use the up and down arrows to review them, then press Enter to select.'
  }

  input.addEventListener('input', renderSuggestions)
  input.addEventListener('focus', function () {
    if (input.value.trim().length >= MIN_CHARS) renderSuggestions()
  })
  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setActiveSuggestion(Math.min(activeIndex + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setActiveSuggestion(Math.max(activeIndex - 1, 0))
    } else if (event.key === 'Escape') {
      closeSuggestions()
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    }
  })
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    if (activeIndex >= 0) selectSuggestion(suggestions[activeIndex])
    else if (suggestions.length) selectSuggestion(suggestions[0])
    else renderSuggestions()
  })
  document.addEventListener('mousedown', function (event) {
    if (!form.contains(event.target)) closeSuggestions()
  })
}

function initCypmdGuidanceSearch () {
  const MIN_CHARS = 3
  const searchInput = document.getElementById('search')
  const searchForm = document.querySelector('.cypmd-search')
  const sections = document.querySelectorAll('.cypmd-guidance-section')
  const navItems = document.querySelectorAll('.cypmd-guidance-nav-item')
  const intro = document.getElementById('cypmd-guidance-intro')
  const noResults = document.getElementById('cypmd-search-no-results')
  const resultsStatus = document.getElementById('cypmd-search-results-status')
  const highlightRoot = document.getElementById('filterable') || document.getElementById('cypmd-guidance-sections')

  if (!searchInput || !sections.length || searchInput.closest('[data-module="cypmd-topic-autocomplete"]')) {
    return
  }

  function normalize (text) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  function getSearchableText (element) {
    return element.textContent.replace(/\s+/g, ' ').trim()
  }

  function setVisible (element, isVisible) {
    element.hidden = !isVisible
  }

  function escapeRegExp (value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function clearHighlights (root) {
    if (!root) {
      return
    }

    root.querySelectorAll('mark.cypmd-search-highlight').forEach(function (mark) {
      const parent = mark.parentNode
      parent.replaceChild(document.createTextNode(mark.textContent), mark)
      parent.normalize()
    })
  }

  function highlightInElement (element, query) {
    if (!element || element.hidden || !query) {
      return
    }

    const regex = new RegExp(escapeRegExp(query), 'gi')
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !regex.test(node.nodeValue)) {
          regex.lastIndex = 0
          return NodeFilter.FILTER_REJECT
        }

        regex.lastIndex = 0
        const parent = node.parentNode

        if (!parent || parent.closest('script, style, textarea, input, .cypmd-search, [hidden]')) {
          return NodeFilter.FILTER_REJECT
        }

        return NodeFilter.FILTER_ACCEPT
      }
    })

    const textNodes = []
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode)
    }

    textNodes.forEach(function (textNode) {
      const text = textNode.nodeValue
      const fragment = document.createDocumentFragment()
      let lastIndex = 0

      text.replace(regex, function (match, offset) {
        if (offset > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, offset)))
        }

        const mark = document.createElement('mark')
        mark.className = 'cypmd-search-highlight'
        mark.textContent = match
        fragment.appendChild(mark)
        lastIndex = offset + match.length
        return match
      })

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
      }

      textNode.parentNode.replaceChild(fragment, textNode)
    })
  }

  function highlightMatches (query) {
    highlightInElement(highlightRoot, query)
  }

  function resetView () {
    clearHighlights(highlightRoot)

    sections.forEach(function (section) {
      setVisible(section, true)
      section.querySelectorAll('.cypmd-guidance-card').forEach(function (card) {
        setVisible(card, true)
      })
    })

    navItems.forEach(function (item) {
      setVisible(item, true)
    })

    if (intro) {
      setVisible(intro, true)
    }

    if (noResults) {
      setVisible(noResults, false)
    }

    if (resultsStatus) {
      resultsStatus.textContent = ''
    }
  }

  function filterContent () {
    const query = normalize(searchInput.value)

    clearHighlights(highlightRoot)

    if (query.length < MIN_CHARS) {
      resetView()
      return
    }

    let visibleSectionCount = 0
    const introMatches = intro && normalize(getSearchableText(intro)).indexOf(query) !== -1

    if (intro) {
      setVisible(intro, introMatches)
    }

    sections.forEach(function (section) {
      const meta = section.querySelector('.cypmd-guidance-section__meta')
      const cards = section.querySelectorAll('.cypmd-guidance-card')
      const metaText = meta ? normalize(getSearchableText(meta)) : ''
      const metaMatches = metaText.indexOf(query) !== -1
      let matchingCardCount = 0

      cards.forEach(function (card) {
        const cardMatches = normalize(getSearchableText(card)).indexOf(query) !== -1

        if (cardMatches) {
          matchingCardCount += 1
        }

        setVisible(card, cardMatches)
      })

      const showSection = metaMatches || matchingCardCount > 0

      if (showSection && metaMatches && matchingCardCount === 0) {
        cards.forEach(function (card) {
          setVisible(card, true)
        })
      }

      setVisible(section, showSection)

      if (showSection) {
        visibleSectionCount += 1
      }
    })

    navItems.forEach(function (item) {
      const navMatches = normalize(getSearchableText(item)).indexOf(query) !== -1
      setVisible(item, navMatches)
    })

    const hasResults = visibleSectionCount > 0 || introMatches

    if (noResults) {
      setVisible(noResults, !hasResults)
    }

    if (resultsStatus) {
      if (!hasResults) {
        resultsStatus.textContent = 'No guidance found for "' + searchInput.value.trim() + '"'
      } else if (visibleSectionCount === 1) {
        resultsStatus.textContent = '1 section found'
      } else if (visibleSectionCount > 1) {
        resultsStatus.textContent = visibleSectionCount + ' sections found'
      } else {
        resultsStatus.textContent = 'Matching text found'
      }
    }

    highlightMatches(query)
  }

  searchInput.addEventListener('input', filterContent)

  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault()
      filterContent()
    })
  }
}
