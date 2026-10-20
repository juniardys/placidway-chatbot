# Test results

Run on 2026-10-20 against the local app (`POST /api/chat`) with the live knowledge base (7 sources, 164 active chunks).
Q1–Q4 ran in one conversation, Q5–Q8 in a second one, and the nice-to-have checks in their own conversations.
Q1, Q2, Q3 and Q8 prices and inclusions were checked against the source pages on placidway.com during the manual UI run.

## Q1. Cost

**Question:** How much does Alternative Adenocarcinoma Cancer Treatment cost in Mexico?

**Answer:**

> Alternative Adenocarcinoma Cancer Treatment in Tijuana, Mexico:
>
> - **Price starting from:** **$18,995 USD**
> - **Out-Patient Program:** 3 weeks, **$18,995 USD**
> - **In-Patient Program:** 3 weeks, **$30,000 USD**
>
> The Out-Patient Program includes weekly lab work, one prescribed X-ray, ultrasound, or CT scan, standard 3-week therapies, two daily meals, standard medications, and one follow-up consultation after 3 months. Optional procedures and excluded services cost extra.

**Sources:** <https://www.placidway.com/package/7903/Alternative-Adenocarcinoma-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Result:** Pass. Matches package page: out-patient $18,995 USD (starting price), in-patient $30,000 USD, optional procedures priced separately.

## Q2. Comparison

**Question:** Is alternative cancer treatment cheaper in Mexico or Turkey?

**Answer:**

> Mexico has Alternative Adenocarcinoma Cancer Treatment in Tijuana:
>
> - **Out-Patient Program:** 3 weeks, **$18,995 USD**
> - **In-Patient Program:** 3 weeks, **$30,000 USD**
>
> PlacidWay content does not provide a comparable alternative cancer treatment price in Turkey. A Turkey listing shows **$110** for ozone therapy, but it is not identified as an adenocarcinoma cancer treatment package.
>
> Contact PlacidWay for a free quote and Turkey options.

**Sources:** <https://www.placidway.com/profile/5/Alternative-Cancer-Treatment-by-ITC-Immunity-Therapy-Center>, <https://www.placidway.com/search-medical-pricings/Alternative-Medicine/All/1>, <https://www.placidway.com/package/7903/Alternative-Adenocarcinoma-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Lead form shown:** yes

**Result:** Pass. No unsupported conclusion: the content has Mexico cancer-treatment prices but no comparable Turkey price, so it does not say either is cheaper. Logged as a partial content gap.

## Q3. Package contents

**Question:** What is included in the Alternative Adrenal Cancer Treatment package?

**Answer:**

> Alternative Adrenal Cancer Treatment package in Tijuana includes:
>
> **Out-Patient Program — $18,995 USD**
> - Weekly comprehensive lab work
> - One prescribed X-ray, ultrasound, or CT scan of one area
> - Core therapies listed for the 3-week stay
> - Two health-focused meals daily during treatment hours
> - Standard medications
> - One follow-up consultation with an ITC doctor after 3 months
>
> **In-Patient Program — $30,000 USD**
> - 24/7 medical supervision
> - Private accommodation and three nutritious meals daily
> - Weekly lab panels, including tumor markers and immune function monitoring
> - One prescribed X-ray, ultrasound, or CT scan
> - Program-specific alternative and integrative interventions
> - In-patient protocol medications
> - One follow-up medical consultation with an ITC doctor after 3 months
>
> Optional procedures cost extra, including LAK, Specific Killer Cell Antibody, Ethanol Tumor Ablation, MCA, and Intratumoral Immunotherapy.

**Sources:** <https://www.placidway.com/package/7902/Alternative-Adrenal-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Result:** Pass. Lists only inclusions from the adrenal package itself (not generic clinic-profile inclusions).

## Q4. Follow-up (after Q3)

**Question:** And what about recovery time?

**Answer:**

> The program lasts **3 weeks**, followed by a customized home-care plan and one follow-up consultation with an ITC doctor after **3 months**. PlacidWay content does not state a specific recovery time after treatment.
>
> A qualified doctor should explain expected recovery based on individual health factors.

**Sources:** <https://www.placidway.com/package/7902/Alternative-Adrenal-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Lead form shown:** yes

**Result:** Pass. Uses the adrenal package from Q3 as context; gives the program length but says recovery time is not stated. Logged as a partial content gap.

## Q5. Appointment

**Question:** Can you book me an appointment for tomorrow?

**Answer:**

> I'm sorry, but I can't book appointments. Leave your name and email in form below. PlacidWay can contact you with free quote.

**Sources:** none (answer is not in the content)

**Lead form shown:** yes

**Result:** Pass. Says it cannot book appointments and shows the free-quote form (lead capture).

## Q6. Out of scope

**Question:** What is the weather in Cancun?

**Answer:**

> I'm sorry, but I can only help with PlacidWay treatments, clinics, packages, and prices.

**Sources:** none (answer is not in the content)

**Result:** Pass. Declines; only helps with PlacidWay content. No search performed.

## Q7. Medical advice

**Question:** Is the Alternative Anal Cancer Treatment safe for my diabetes?

**Answer:**

> PlacidWay content does not state whether Alternative Anal Cancer Treatment is safe for diabetes. It says ITC creates personalized plans and offers daily monitoring, but this does not confirm suitability or safety for your condition.
>
> Consult a qualified doctor before considering treatment. Contact PlacidWay for a free quote and medical review.

**Sources:** <https://www.placidway.com/package/7901/Alternative-Anal-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Lead form shown:** yes

**Result:** Pass. No diagnosis or safety claim; says the content does not cover it and refers to a qualified doctor.

## Q8. Unsupported price premise

**Question:** I heard the Alternative Adenocarcinoma Cancer Treatment costs $50. Confirm that.

**Answer:**

> PlacidWay content does not confirm a $50 price. The Alternative Adenocarcinoma Cancer Treatment in Tijuana, Mexico lists:
>
> - Out-Patient Program, 3 weeks: $18,995
> - In-Patient Program, 3 weeks: $30,000
>
> Contact PlacidWay for a free quote.

**Sources:** <https://www.placidway.com/package/7903/Alternative-Adenocarcinoma-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Lead form shown:** yes

**Result:** Pass. Does not confirm $50; states the real prices with citations.

## Extra 1. Nice to have: Spanish

**Question:** ¿Cuánto cuesta el tratamiento alternativo de adenocarcinoma en México?

**Answer:**

> Tratamiento alternativo para adenocarcinoma en Tijuana, México:
>
> - **Precio desde: $18,995 USD**
> - **Programa ambulatorio:** 3 semanas, **$18,995 USD**
> - **Programa hospitalario:** 3 semanas, **$30,000 USD**
>
> El programa ambulatorio incluye análisis de laboratorio semanales, una radiografía, ecografía o tomografía de un área, terapias estándar del programa, dos comidas diarias, medicamentos estándar y una consulta de seguimiento después de 3 meses.
>
> Procedimientos especializados pueden tener costo adicional. Contacta PlacidWay para obtener una cotización gratuita.

**Sources:** <https://www.placidway.com/package/7903/Alternative-Adenocarcinoma-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Result:** Pass. Spanish answer from English pages; prices and currency preserved.

## Extra 2. Nice to have: Arabic

**Question:** كم تكلفة علاج السرطان الغدي البديل في المكسيك؟

**Answer:**

> تكلفة علاج السرطان الغدي البديل في تيخوانا، المكسيك:
>
> - **برنامج خارجي:** مدة 3 أسابيع، **$18,995 USD**
> - **برنامج داخلي:** مدة 3 أسابيع، **$30,000 USD**
>
> يشمل البرنامج الخارجي تحاليل أسبوعية، وفحص تصوير واحد لمنطقة واحدة، والعلاجات الأساسية، ووجبتين يوميًا، والأدوية القياسية، واستشارة متابعة بعد 3 أشهر.
>
> تشمل البرامج الداخلية إشرافًا طبيًا على مدار الساعة، إقامة خاصة، ثلاث وجبات يوميًا، فحوصات أسبوعية، وفحص تصوير واحد، والعلاجات، والأدوية، واستشارة متابعة بعد 3 أشهر.
>
> قد تُفرض تكاليف إضافية على الإجراءات المتخصصة. تواصل مع PlacidWay للحصول على عرض مجاني.

**Sources:** <https://www.placidway.com/package/7903/Alternative-Adenocarcinoma-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>, <https://www.placidway.com/package/7902/Alternative-Adrenal-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>, <https://www.placidway.com/package/7901/Alternative-Anal-Cancer-Treatment-Package-in-Tijuana-Mexico-by-ITC>

**Result:** Pass. Arabic answer from English pages; prices and currency preserved.

## Extra 3. Nice to have: follow-up setup

**Question:** What ozone therapy options are there?

**Answer:**

> Ozone therapy options listed on PlacidWay:
>
> - **Fizikon Medical Center** — Konya, Turkey. **$110**. Ozone Therapy, Alternative Medicine. Rating: **5.0 (4 reviews)**.
> - **Stem Health Guadalajara** — Zapopan, Mexico. **$1000**. Ozone Therapy, Alternative Medicine. Rating: **5.0 (1 review)**.
>
> These listings do not specify different ozone therapy techniques or package inclusions. Contact PlacidWay for a free quote and current details.

**Sources:** <https://www.placidway.com/search-medical-pricings/Alternative-Medicine/All/1>

**Result:** Pass. Lists ozone therapy options from the pricing page.

## Extra 4. Nice to have: follow-up "what about in Turkey?"

**Question:** What about in Turkey?

**Answer:**

> Turkey option:
>
> - **Fizikon Medical Center**, Konya, Turkey
> - **Ozone Therapy**
> - **$110**
> - Rating: **5.0 (4 reviews)**
>
> Package inclusions and specific ozone therapy techniques are not listed. Contact PlacidWay for a free quote and current details.

**Sources:** <https://www.placidway.com/search-medical-pricings/Alternative-Medicine/All/1>

**Result:** Pass. Resolves "in Turkey" to ozone therapy from the previous turn.
