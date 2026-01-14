# Form Analysis Report
**URL:** https://www.selenium.dev/selenium/web/web-form.html
**Container:** `form`
**Total Elements:** 33
**Validation:** 33 unique selectors, 0 ambiguous

## Full Page View
![Container highlighted](screenshots/container-full-page.png)

## Table of Contents
- [INPUT-TEXT](#input-text)
- [INPUT-PASSWORD](#input-password)
- [TEXTAREA](#textarea)
- [LINK](#link)
- [SELECT](#select)
- [INPUT](#input)
- [INPUT-FILE](#input-file)
- [INPUT-CHECKBOX](#input-checkbox)
- [INPUT-RADIO](#input-radio)
- [BUTTON](#button)
- [INPUT-COLOR](#input-color)
- [INPUT-RANGE](#input-range)
- [INPUT-HIDDEN](#input-hidden)

## INPUT-TEXT
Found 4 item(s)

### Text input
![#my-text-id](screenshots/element-001.png)

**Label Selector:**
```css
label:has(#my-text-id)
```

**Field Selector:**
```css
#my-text-id
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Text input |
| Tag Name | `input` |
| Type | `text` |
| ID | `my-text-id` |
| Name | `my-text` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

### Disabled input
![input[name="my-disabled"]](screenshots/element-002.png)

**Label Selector:**
```css
label:has(input[name="my-disabled"])
```

**Field Selector:**
```css
input[name="my-disabled"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Disabled input |
| Tag Name | `input` |
| Type | `text` |
| Name | `my-disabled` |
| Placeholder | Disabled input |
| Required | No |
| Disabled | Yes |
| Visible | Yes |

---

### Readonly input
![input[name="my-readonly"]](screenshots/element-003.png)

**Label Selector:**
```css
label:has(input[name="my-readonly"])
```

**Field Selector:**
```css
input[name="my-readonly"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Readonly input |
| Tag Name | `input` |
| Type | `text` |
| Name | `my-readonly` |
| Value | Readonly input |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

### Date picker
![input[name="my-date"]](screenshots/element-004.png)

**Label Selector:**
```css
label:has(input[name="my-date"])
```

**Field Selector:**
```css
input[name="my-date"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Date picker |
| Tag Name | `input` |
| Type | `text` |
| Name | `my-date` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT-PASSWORD
Found 1 item(s)

### Password
![input[name="my-password"]](screenshots/element-005.png)

**Label Selector:**
```css
label:has(input[name="my-password"])
```

**Field Selector:**
```css
input[name="my-password"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Password |
| Tag Name | `input` |
| Type | `password` |
| Name | `my-password` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## TEXTAREA
Found 1 item(s)

### Textarea
![textarea[name="my-textarea"]](screenshots/element-006.png)

**Label Selector:**
```css
label:has(textarea[name="my-textarea"])
```

**Field Selector:**
```css
textarea[name="my-textarea"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Textarea |
| Tag Name | `textarea` |
| Name | `my-textarea` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## LINK
Found 1 item(s)

### Return to index
![a[href="./index.html"]](screenshots/element-007.png)

**Selector:**
```css
a[href="./index.html"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Tag Name | `a` |
| Text Content | Return to index |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## SELECT
Found 1 item(s)

### Dropdown (select)
              
                O
![select[name="my-select"]](screenshots/element-008.png)

**Label Selector:**
```css
label:has(select[name="my-select"])
```

**Field Selector:**
```css
select[name="my-select"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Dropdown (select)
              
                O... |
| Tag Name | `select` |
| Name | `my-select` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT
Found 1 item(s)

### Dropdown (datalist)
![input[name="my-datalist"]](screenshots/element-009.png)

**Label Selector:**
```css
label:has(input[name="my-datalist"])
```

**Field Selector:**
```css
input[name="my-datalist"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Dropdown (datalist) |
| Tag Name | `input` |
| Name | `my-datalist` |
| Placeholder | Type to search... |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT-FILE
Found 1 item(s)

### File input
![input[name="my-file"]](screenshots/element-010.png)

**Label Selector:**
```css
label:has(input[name="my-file"])
```

**Field Selector:**
```css
input[name="my-file"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | File input |
| Tag Name | `input` |
| Type | `file` |
| Name | `my-file` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT-CHECKBOX
Found 2 item(s)

### Checked checkbox
![#my-check-1](screenshots/element-011.png)

**Label Selector:**
```css
label:has(#my-check-1)
```

**Field Selector:**
```css
#my-check-1
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Checked checkbox |
| Tag Name | `input` |
| Type | `checkbox` |
| ID | `my-check-1` |
| Name | `my-check` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

### Default checkbox
![#my-check-2](screenshots/element-012.png)

**Label Selector:**
```css
label:has(#my-check-2)
```

**Field Selector:**
```css
#my-check-2
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Default checkbox |
| Tag Name | `input` |
| Type | `checkbox` |
| ID | `my-check-2` |
| Name | `my-check` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT-RADIO
Found 2 item(s)

### Checked radio
![#my-radio-1](screenshots/element-013.png)

**Label Selector:**
```css
label:has(#my-radio-1)
```

**Field Selector:**
```css
#my-radio-1
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Checked radio |
| Tag Name | `input` |
| Type | `radio` |
| ID | `my-radio-1` |
| Name | `my-radio` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

### Default radio
![#my-radio-2](screenshots/element-014.png)

**Label Selector:**
```css
label:has(#my-radio-2)
```

**Field Selector:**
```css
#my-radio-2
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Default radio |
| Tag Name | `input` |
| Type | `radio` |
| ID | `my-radio-2` |
| Name | `my-radio` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## BUTTON
Found 1 item(s)

### Submit
![button[type="submit"]](screenshots/element-015.png)

**Selector:**
```css
button[type="submit"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Tag Name | `button` |
| Type | `submit` |
| Text Content | Submit |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT-COLOR
Found 1 item(s)

### Color picker
![input[name="my-colors"]](screenshots/element-016.png)

**Label Selector:**
```css
label:has(input[name="my-colors"])
```

**Field Selector:**
```css
input[name="my-colors"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Color picker |
| Tag Name | `input` |
| Type | `color` |
| Name | `my-colors` |
| Value | #563d7c |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT-RANGE
Found 1 item(s)

### Example range
![input[name="my-range"]](screenshots/element-017.png)

**Label Selector:**
```css
label:has(input[name="my-range"])
```

**Field Selector:**
```css
input[name="my-range"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Label Text | Example range |
| Tag Name | `input` |
| Type | `range` |
| Name | `my-range` |
| Value | 5 |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

## INPUT-HIDDEN
Found 1 item(s)

### my-hidden
![input[name="my-hidden"]](screenshots/element-018.png)

**Selector:**
```css
input[name="my-hidden"]
```

**Properties:**
| Property | Value |
|----------|-------|
| Tag Name | `input` |
| Type | `hidden` |
| Name | `my-hidden` |
| Label | `my-hidden` |
| Required | No |
| Disabled | No |
| Visible | Yes |

---

---

*Generated on 1/14/2026, 1:08:40 PM*
