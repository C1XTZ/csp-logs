from bs4 import BeautifulSoup
import html

def convert_code_element(element):
    return f"`{element.get_text()}`" if element.name=='code' else element.string

def process_text_with_entities(text):
    return html.unescape(text)

def convert_quotes_to_backticks(text):
    return text.replace('\u201c','`').replace('\u201d','`')

def process_content(content_list):
    text=''.join(content_list).strip()
    for p in[';','.',',']: 
        if text.endswith(f' {p}'): text=text[:-2]+p
    return convert_quotes_to_backticks(text)

def parse_li_content(li_element):
    content=[]
    for child in li_element.children:
        if child.name=='ul': continue
        elif child.name=='code':
            prev_text=content[-1] if content else ''
            if content and not prev_text.strip().endswith('('): content.append(' ')
            content.append(f"`{child.get_text()}`")
            next_sibling=child.next_sibling
            if next_sibling and isinstance(next_sibling,str) and not next_sibling.strip()[0] in ');.,:': content.append(' ')
        elif isinstance(child,str): content.append(' '.join(child.split()))
    return process_content(content)

def parse_changelog(changelog,indent_level=0,indent_spaces=4):
    markdown=""
    indent=' '*indent_spaces
    for section in changelog.find_all(['h3','h4','ul','p'],recursive=False):
        if section.name in['h3','h4','p']: markdown+=f"\n## {process_text_with_entities(section.get_text(strip=True)).rstrip(":")}\n\n"
        elif section.name=='ul':
            for li in section.find_all('li',recursive=False):
                main_text=parse_li_content(li)
                if main_text: markdown+=f"{indent*indent_level}*   {main_text}\n"
                nested_ul=li.find('ul',recursive=False)
                if nested_ul:
                    for nested_li in nested_ul.find_all('li',recursive=False):
                        nested_text=parse_li_content(nested_li)
                        if nested_text: markdown+=f"{indent*(indent_level+1)}*   {nested_text}\n"
            for nested_section in section.find_all(['h3','h4','ul','p'],recursive=False):
                if nested_section.name!='ul': markdown+=parse_changelog(nested_section,indent_level,indent_spaces)
    return markdown

def convert_html_to_markdown(input_html):
    soup=BeautifulSoup(input_html,'html.parser')
    title=soup.find('h3')
    title_text=title.get_text(strip=True) if title else'Unknown Version'
    version_details=soup.find('div',class_='version-block')
    details=version_details.find_all('li')
    version_id=details[0].get_text(strip=True).replace('Version ID:','').strip()
    size=details[2].get_text(strip=True).replace('Size:','').strip()
    changelog_section=soup.find('div',class_='changelog')
    changelog_markdown=parse_changelog(changelog_section)
    markdown=f"---\ntitle: {process_text_with_entities(title_text)}\n---\n\n"
    markdown+=f"*   Version ID: {process_text_with_entities(version_id)}\n"
    markdown+=f"*   Size: {process_text_with_entities(size)}\n"
    markdown+=f"\n# Changelog\n{changelog_markdown}"
    return markdown

def save_markdown_file(markdown,filename="output.md"):
    with open(filename,'w',encoding='utf-8') as f: f.write(markdown)

with open('input.html','r',encoding='utf-8') as file: input_html=file.read()
markdown=convert_html_to_markdown(input_html)
save_markdown_file(markdown,'output.md')
print("Markdown conversion complete. Saved as output.md.")