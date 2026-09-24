(() => {
  const header = document.querySelector("[data-header]");
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  const year = document.querySelector("[data-year]");
  const form = document.querySelector("[data-give-form]");
  const thanks = document.querySelector("[data-thanks]");
  const thanksClose = document.querySelector("[data-thanks-close]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const greetingEl = document.querySelector("[data-greeting]");
  const greetingText = document.querySelector("[data-greeting-text]");

  const liveGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Good night";
  };

  const typeGreeting = (text) => {
    if (!greetingText || !greetingEl) return;

    if (reduceMotion) {
      greetingText.textContent = text;
      greetingEl.classList.remove("is-typing");
      greetingEl.classList.add("is-done");
      return;
    }

    greetingEl.classList.add("is-typing");
    greetingEl.classList.remove("is-done");
    greetingText.textContent = "";
    let i = 0;

    const tick = () => {
      greetingText.textContent = text.slice(0, i);
      i += 1;
      if (i <= text.length) {
        window.setTimeout(tick, 55);
      } else {
        greetingEl.classList.remove("is-typing");
        greetingEl.classList.add("is-done");
      }
    };

    tick();
  };

  // Type greeting under the logo as soon as the page is ready
  if (greetingEl) {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => typeGreeting(liveGreeting()), reduceMotion ? 0 : 450);
    });
  }

  // Keep greeting fresh if they stay on the page across hours
  window.setInterval(() => {
    if (!greetingEl?.classList.contains("is-done")) return;
    const next = liveGreeting();
    if (greetingText && greetingText.textContent !== next) {
      typeGreeting(next);
    }
  }, 60_000);

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setMenu = (open) => {
    if (!menuToggle || !mobileNav) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileNav.classList.toggle("is-open", open);
    if (open) {
      mobileNav.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
    } else {
      mobileNav.setAttribute("hidden", "");
      document.body.style.overflow = "";
    }
  };

  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    setMenu(open);
  });

  mobileNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  const revealEls = [...document.querySelectorAll("[data-reveal]")];
  const heroReveals = revealEls.filter((el) => el.closest(".hero"));
  const pageReveals = revealEls.filter((el) => !el.closest(".hero"));

  const show = (el) => el.classList.add("is-visible");

  if (reduceMotion) {
    revealEls.forEach(show);
  } else {
    // Staggered hero entrance on load
    requestAnimationFrame(() => {
      heroReveals.forEach(show);
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              show(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
      );
      pageReveals.forEach((el) => observer.observe(el));
    } else {
      pageReveals.forEach(show);
    }
  }

  const typeCauseWord = (el, word, delay = 0) => {
    const line = el.closest(".cause-donate-line");
    let i = 0;
    el.textContent = "";
    line?.classList.remove("is-done");

    const tick = () => {
      i += 1;
      el.textContent = word.slice(0, i);
      if (i < word.length) {
        window.setTimeout(tick, 70);
      } else {
        line?.classList.add("is-done");
      }
    };

    window.setTimeout(tick, delay);
  };

  const causeTypeEls = [...document.querySelectorAll("[data-cause-type]")];
  if (causeTypeEls.length) {
    if (reduceMotion) {
      causeTypeEls.forEach((el) => {
        el.textContent = el.dataset.typeWord || "Donate";
        el.closest(".cause-donate-line")?.classList.add("is-done");
      });
    } else if ("IntersectionObserver" in window) {
      const typeObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const card = el.closest(".cause");
            const delay = Number(card?.dataset.delay || 0) * 120;
            typeCauseWord(el, el.dataset.typeWord || "Donate", delay);
            typeObserver.unobserve(el);
          });
        },
        { threshold: 0.35 }
      );
      causeTypeEls.forEach((el) => typeObserver.observe(el));
    } else {
      causeTypeEls.forEach((el, index) => {
        typeCauseWord(el, el.dataset.typeWord || "Donate", index * 120);
      });
    }
  }

  const RAISED_KEY = "kindred-raised";

  const defaultRaised = () => {
    const map = {};
    document.querySelectorAll("[data-cause-fund]").forEach((el) => {
      const key = el.dataset.causeFund;
      const base = Number(el.dataset.baseRaised || 0);
      if (key) map[key] = base;
    });
    // Fallback defaults if homepage markup isn't present (donate page)
    return {
      filters: 31000,
      family: 55000,
      well: 390000,
      learning: 28000,
      ...map,
    };
  };

  const readRaised = () => {
    try {
      const raw = localStorage.getItem(RAISED_KEY);
      if (!raw) return defaultRaised();
      const parsed = JSON.parse(raw);
      return { ...defaultRaised(), ...parsed };
    } catch {
      return defaultRaised();
    }
  };

  const writeRaised = (map) => {
    try {
      localStorage.setItem(RAISED_KEY, JSON.stringify(map));
    } catch {
      /* ignore quota / private mode */
    }
  };

  const addDonation = (causeKey, amount) => {
    const known = ["filters", "family", "well", "learning"];
    if (!known.includes(causeKey) || !Number.isFinite(amount) || amount <= 0) return null;
    const map = readRaised();
    map[causeKey] = Number(map[causeKey] || 0) + amount;
    writeRaised(map);
    return map[causeKey];
  };

  const renderRaisedFunds = () => {
    const map = readRaised();
    document.querySelectorAll("[data-cause-fund]").forEach((el) => {
      const key = el.dataset.causeFund;
      const goal = Number(el.dataset.goal || 0);
      const raised = Number(map[key] ?? el.dataset.baseRaised ?? 0);
      const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
      el.style.setProperty("--raised", String(pct));
      const label = el.querySelector("[data-raised-label]");
      const pctEl = el.querySelector("[data-raised-pct]");
      if (label) label.textContent = `KSh ${raised.toLocaleString("en-KE")}`;
      if (pctEl) pctEl.textContent = `${pct}%`;
    });
  };

  const renderGenerousBag = (opts = {}) => {
    const amountEl = document.querySelector("[data-contributed-amount]");
    const metaEl = document.querySelector("[data-contributed-meta]");
    const bag = document.querySelector("[data-generous-bag]");
    if (!amountEl) return;

    const map = readRaised();
    const params = new URLSearchParams(window.location.search);
    const causeInput = document.querySelector("[data-cause-input]");
    const key = (opts.causeKey || causeInput?.value || params.get("cause") || "").trim();
    const labels = {
      filters: "Household filters",
      family: "Family water kit",
      well: "Community well share",
      learning: "Learning & books",
    };

    let total;
    if (key && map[key] != null) {
      total = Number(map[key] || 0);
      if (metaEl) metaEl.textContent = `Raised for ${labels[key] || "this cause"}`;
    } else {
      total = ["filters", "family", "well", "learning"].reduce(
        (sum, k) => sum + Number(map[k] || 0),
        0
      );
      if (metaEl) metaEl.textContent = "Across all Kindred causes";
    }

    amountEl.textContent = `KSh ${Number(total).toLocaleString("en-KE")}`;

    if (opts.pulse && bag) {
      bag.classList.remove("is-pulse");
      void bag.offsetWidth;
      bag.classList.add("is-pulse");
    }
  };

  const amountInput = document.querySelector("[data-donate-amount]");
  const submitAmount = document.querySelector("[data-submit-amount]");

  const formatKsh = (value) => {
    if (value === "" || value == null) return "KSh —";
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return "KSh —";
    return `KSh ${num.toLocaleString("en-KE")}`;
  };

  const syncAmountUi = () => {
    if (!amountInput) return;
    const formatted = formatKsh(amountInput.value);
    if (submitAmount) submitAmount.textContent = formatted;
    const payTotal = document.querySelector("[data-pay-total]");
    if (payTotal) payTotal.textContent = formatted;
  };

  const setCause = (causeKey) => {
    const causeInput = document.querySelector("[data-cause-input]");
    const selectedEl = document.querySelector("[data-donate-selected]");
    if (causeKey && causes[causeKey]) {
      if (causeInput) causeInput.value = causeKey;
      if (selectedEl) selectedEl.textContent = causes[causeKey].label;
    }
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const amount = Number(data.get("donateAmount"));
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phoneRaw = String(data.get("mpesaPhone") || "").replace(/\s+/g, "");
    const phoneOk = /^[17]\d{8}$/.test(phoneRaw);

    if (!name || !email) return;

    if (!phoneOk) {
      document.querySelector("[data-mpesa-phone]")?.focus();
      return;
    }

    if (!Number.isFinite(amount) || amount < 100) {
      amountInput?.focus();
      return;
    }

    const causeKey = String(data.get("cause") || "").trim();
    addDonation(causeKey, amount);
    renderGenerousBag({ causeKey, pulse: true });

    form.hidden = true;
    if (thanks) {
      thanks.hidden = false;
      const thanksCopy = thanks.querySelector("[data-thanks-copy]") || thanks.querySelector("p:not(.label)");
      if (thanksCopy) {
        thanksCopy.textContent = `STK push sent to +254${phoneRaw} for ${formatKsh(amount)}. Enter your M-Pesa PIN on your phone to complete the gift.`;
      }
    }
  });

  thanksClose?.addEventListener("click", () => {
    if (thanks) thanks.hidden = true;
    if (form) {
      form.hidden = false;
      form.reset();
      applyCauseFromUrl();
      syncAmountUi();
    }
  });

  const causes = {
    filters: {
      title: "Donate for household filters",
      lede: "Enter any amount in KSh. You’ll get an M-Pesa STK push to confirm on your phone.",
      label: "Household filters",
    },
    family: {
      title: "Donate for a family water kit",
      lede: "Enter any amount in KSh. You’ll get an M-Pesa STK push to confirm on your phone.",
      label: "Family water kit",
    },
    learning: {
      title: "Donate for learning & books",
      lede: "Enter any amount in KSh. You’ll get an M-Pesa STK push to confirm on your phone.",
      label: "Learning & books",
    },
    well: {
      title: "Donate for a community well share",
      lede: "Enter any amount in KSh. You’ll get an M-Pesa STK push to confirm on your phone.",
      label: "Community well share",
    },
  };

  const applyCauseFromUrl = () => {
    if (!form && !document.querySelector("[data-donate-title]")) return;
    const params = new URLSearchParams(window.location.search);
    const key = params.get("cause");
    const cause = key ? causes[key] : null;
    const causeInput = document.querySelector("[data-cause-input]");
    const titleEl = document.querySelector("[data-donate-title]");
    const ledeEl = document.querySelector("[data-donate-lede]");
    const selectedEl = document.querySelector("[data-donate-selected]");

    if (cause) {
      setCause(key);
      if (titleEl) titleEl.textContent = cause.title;
      if (ledeEl) ledeEl.textContent = cause.lede;
    } else {
      if (causeInput) causeInput.value = "";
      if (selectedEl) selectedEl.textContent = "General gift";
    }
    syncAmountUi();
    renderGenerousBag({ causeKey: key || "" });
  };

  amountInput?.addEventListener("input", syncAmountUi);

  applyCauseFromUrl();
  syncAmountUi();
  renderRaisedFunds();
  renderGenerousBag();
  const heroSlider = document.querySelector("[data-hero-slider]");
  const slideImgs = [...document.querySelectorAll("[data-slide-img]")];
  const heroCopy = document.querySelector("[data-hero-copy]");

  const slides = [
    {
      title: "They should not have to drink what the ground gives them.",
      typed: "Dignity starts with a safe cup.",
      alt: "Children collecting cloudy water from a puddle near aid tents",
    },
    {
      title: "A child reading should never be a rare kindness.",
      typed: "Learning should feel ordinary.",
      alt: "A teacher guiding a young girl reading at a classroom desk",
    },
  ];

  let slideIndex = 0;
  let slideTimer;
  let typeTimer;
  const typeTarget = document.querySelector("[data-type-text]");

  const typeText = (text) => {
    window.clearTimeout(typeTimer);
    if (!typeTarget) return;

    if (reduceMotion) {
      typeTarget.textContent = text;
      return;
    }

    typeTarget.textContent = "";
    let i = 0;

    const tick = () => {
      typeTarget.textContent = text.slice(0, i);
      i += 1;
      if (i <= text.length) {
        typeTimer = window.setTimeout(tick, 38);
      }
    };

    tick();
  };

  const setSlide = (index, animateCopy = true) => {
    if (!slideImgs.length) return;
    slideIndex = (index + slideImgs.length) % slideImgs.length;

    slideImgs.forEach((img, i) => {
      img.classList.toggle("is-active", i === slideIndex);
      img.alt = i === slideIndex ? slides[i].alt : "";
    });

    const data = slides[slideIndex];
    const titleEl = heroCopy?.querySelector("h1");

    const applyCopy = () => {
      if (titleEl) titleEl.textContent = data.title;
      heroCopy?.classList.remove("is-swap");
      typeText(data.typed);
    };

    if (animateCopy && heroCopy && !reduceMotion) {
      heroCopy.classList.add("is-swap");
      window.clearTimeout(typeTimer);
      if (typeTarget) typeTarget.textContent = "";
      window.setTimeout(applyCopy, 280);
    } else {
      applyCopy();
    }
  };

  if (heroSlider && slideImgs.length > 1) {
    setSlide(0, false);

    if (!reduceMotion) {
      slideTimer = window.setInterval(() => setSlide(slideIndex + 1), 5500);
      heroSlider.addEventListener("mouseenter", () => window.clearInterval(slideTimer));
      heroSlider.addEventListener("mouseleave", () => {
        window.clearInterval(slideTimer);
        slideTimer = window.setInterval(() => setSlide(slideIndex + 1), 5500);
      });
    }
  }

  /* Story section auto-rotating images + copy */
  const storySlider = document.querySelector("[data-story-slider]");
  const storyImgs = [...document.querySelectorAll("[data-story-img]")];
  const storyCopy = document.querySelector("[data-story-copy]");
  const storyCaption = document.querySelector(".story-caption");

  const storySlides = [
    {
      alt: "Children smiling with hope outdoors",
      tag: "Hope, up close",
      note: "Joy returns when water is safe.",
      kicker: "Why it matters",
      title: "Every child deserves",
      titleEm: "a day that looks like this.",
      lead: "Clean water is more than a drink. It means fewer sick days, more time in school, and room for play — the ordinary joys childhood should hold.",
      body: "Your gift helps Kindred fund wells, filters, and local care so communities can thrive. Safe water today. Stronger tomorrows.",
    },
    {
      alt: "Children laughing together in a rural community",
      tag: "Belonging",
      note: "Laughter is what childhood should sound like.",
      kicker: "What changes",
      title: "When water is close,",
      titleEm: "a whole day opens up.",
      lead: "Hours once spent walking for muddy water become hours for learning, helping at home, and simply being a child.",
      body: "Kindred partners with local teams so clean water stays working long after the first gift arrives.",
    },
    {
      alt: "Teacher helping a girl read in a classroom",
      tag: "Learning",
      note: "A desk. A book. A chance to stay.",
      kicker: "Beyond the well",
      title: "Clean water makes",
      titleEm: "school possible again.",
      lead: "Children miss class when they are sick from unsafe water, or when fetching it takes the morning.",
      body: "Support learning materials too — so when water is solved, education does not stop.",
    },
    {
      alt: "Children smiling despite hardship",
      tag: "Dignity",
      note: "They are not a statistic. They are kids.",
      kicker: "Who we serve",
      title: "We see the child,",
      titleEm: "not only the need.",
      lead: "Every gift is personal: one household filter, one family kit, one share of a village well.",
      body: "Choose a cause and give what you can in KSh through M-Pesa. Small gifts still move water.",
    },
    {
      alt: "Children collecting muddy water near aid tents",
      tag: "The reality",
      note: "No child should drink what the ground gives them.",
      kicker: "Why we started",
      title: "This is what we",
      titleEm: "are working to end.",
      lead: "Across too many communities, the only water nearby is muddy, shared, and unsafe — yet still what children collect.",
      body: "Your donation funds the fix: filters, wells, and care that turn survival into something steadier.",
    },
  ];

  let storyIndex = 0;
  let storyTimer;

  const setStorySlide = (index, animate = true) => {
    if (!storyImgs.length) return;
    storyIndex = (index + storyImgs.length) % storyImgs.length;
    const data = storySlides[storyIndex] || storySlides[0];

    storyImgs.forEach((img, i) => {
      img.classList.toggle("is-active", i === storyIndex);
      img.alt = i === storyIndex ? data.alt : "";
    });

    const applyCopy = () => {
      const tag = document.querySelector("[data-story-tag]");
      const note = document.querySelector("[data-story-note]");
      const kicker = document.querySelector("[data-story-kicker]");
      const titleMain = document.querySelector("[data-story-title-main]");
      const titleEm = document.querySelector("[data-story-title-em]");
      const lead = document.querySelector("[data-story-lead]");
      const body = document.querySelector("[data-story-body]");

      if (tag) tag.textContent = data.tag;
      if (note) note.textContent = data.note;
      if (kicker) kicker.textContent = data.kicker;
      if (titleMain) titleMain.textContent = data.title;
      if (titleEm) titleEm.textContent = data.titleEm;
      if (lead) lead.textContent = data.lead;
      if (body) body.textContent = data.body;

      storyCopy?.classList.remove("is-swap");
      storyCaption?.classList.remove("is-swap");
    };

    if (animate && !reduceMotion) {
      storyCopy?.classList.add("is-swap");
      storyCaption?.classList.add("is-swap");
      window.setTimeout(applyCopy, 320);
    } else {
      applyCopy();
    }
  };

  if (storySlider && storyImgs.length > 1) {
    setStorySlide(0, false);

    if (!reduceMotion) {
      const startStory = () => {
        window.clearInterval(storyTimer);
        storyTimer = window.setInterval(() => setStorySlide(storyIndex + 1), 6000);
      };
      startStory();
      storySlider.addEventListener("mouseenter", () => window.clearInterval(storyTimer));
      storySlider.addEventListener("mouseleave", startStory);
    }
  }

  /* Voices section uses CSS grid only — no marquee / platform filters */

  if (!reduceMotion && slideImgs.length) {
    window.addEventListener(
      "scroll",
      () => {
        const y = Math.min(window.scrollY, 400);
        const active = document.querySelector(".hero-img.is-active");
        if (active) active.style.translate = `0 ${y * 0.22}px`;
      },
      { passive: true }
    );
  }
})();
