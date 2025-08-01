import configparser
import html
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

from bs4 import BeautifulSoup, Tag

INPUT_HTML_FILE = "acstuff.club.htm"
ZIP_PATTERN = "lights-patch-v*-preview*-full.zip"
MANIFEST_PATH = "extension/config/data_manifest.ini"
OUTPUT_FOLDER = "csp-logs"
PUNCTUATION_PATTERN = re.compile(r" ([;.,:])$")
PREVIEW_REGEX = re.compile(r"preview(\d+)", re.IGNORECASE)

@dataclass
class VersionInfo:
    title: str
    version_id: str
    size: str
    is_preview: bool = False
    preview_number: str = "1"

class CSPLogProcessor:
    def __init__(self):
        self.desktop_path = Path.home() / "Desktop"
        self.output_dir = self.desktop_path / OUTPUT_FOLDER

    def _parse_li_content(self, li_element: Tag) -> str:
        content_parts = []
        for child in li_element.children:
            if not hasattr(child, "name"):
                content_parts.append(html.unescape(str(child)))
            elif child.name == "code":
                content_parts.append(f"`{child.get_text(strip=True)}`")
            elif child.name != "ul":
                content_parts.append(html.unescape(str(child)))

        text = "".join(content_parts)
        text = re.sub(r'(`.*?`)(/)(`.*?`)', r'\1 \2 \3', text)
        text = " ".join(text.split())
        text = PUNCTUATION_PATTERN.sub(r"\1", text)
        return text.replace("\u201c", "`").replace("\u201d", "`")

    def _parse_ul_node(self, ul_node: Tag, indent: str) -> str:
        parts = []
        for li in ul_node.find_all("li", recursive=False):
            if main_text := self._parse_li_content(li):
                parts.append(f"{indent}*   {main_text}\n")
            if nested_ul := li.find("ul", recursive=False):
                parts.append(self._parse_ul_node(nested_ul, indent + "    "))
        return "".join(parts)

    def _parse_changelog_nodes(self, nodes: Iterator[Tag]) -> str:
        parts = []
        for node in nodes:
            if node.name in {"h1", "h3", "h4", "p"}:
                text = html.unescape(node.get_text(strip=True)).rstrip(":")
                parts.append(f"\n## {text}\n\n")
            elif node.name == "ul":
                parts.append(self._parse_ul_node(node, ""))
        return "".join(parts)

    def _parse_changelog(self, changelog_container: Optional[Tag]) -> str:
        if not changelog_container:
            return ""
        nodes = changelog_container.find_all(
            ["h1", "h3", "h4", "ul", "p"], recursive=False
        )
        return self._parse_changelog_nodes(nodes)

    def _extract_version_info(self, soup: BeautifulSoup) -> VersionInfo:
        title = "Unknown Version"
        if title_element := soup.find("h3"):
            title = title_element.get_text(strip=True)

        if not (version_details := soup.find("div", class_="version-block")):
            return VersionInfo(title, "Unknown", "Unknown")

        details = version_details.find_all("li")
        if len(details) < 3:
            return VersionInfo(title, "Unknown", "Unknown")

        version_id = details[0].get_text(strip=True).replace("Version ID:", "").strip()
        size = details[2].get_text(strip=True).replace("Size:", "").strip()
        return VersionInfo(title, version_id, size)

    def _find_preview_zip(self) -> Optional[Path]:
        try:
            return next(self.desktop_path.glob(ZIP_PATTERN), None)
        except StopIteration:
            return None

    def _read_manifest_from_zip(
        self, zip_path: Path
    ) -> Optional[tuple[str, str]]:
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                manifest_content = zf.read(MANIFEST_PATH).decode("utf-8")

            config = configparser.ConfigParser(strict=False)
            config.read_string(manifest_content)

            version = config.get("VERSION", "shaders_patch", fallback=None)
            build = config.get("VERSION", "shaders_patch_build", fallback=None)

            if version and build:
                print(f"Found preview version: {version}, build: {build}")
                return version, build
        except (zipfile.BadZipFile, KeyError, configparser.Error, FileNotFoundError) as e:
            print(f"Warning: Could not read manifest from {zip_path}: {e}")
        return None

    def _create_preview_version_info(
        self, zip_path: Path
    ) -> Optional[VersionInfo]:
        if not (manifest_data := self._read_manifest_from_zip(zip_path)):
            return None

        version, build = manifest_data
        preview_match = PREVIEW_REGEX.search(zip_path.name)
        preview_num = preview_match.group(1) if preview_match else "1"
        
        try:
            size_bytes = zip_path.stat().st_size
            size_mb = f"{size_bytes / (1024 * 1024):.2f} MB"
        except OSError as e:
            print(f"Warning: Could not get file size for {zip_path}: {e}")
            size_mb = "Unknown"

        return VersionInfo(
            title=f"v{version}",
            version_id=build,
            size=size_mb,
            is_preview=True,
            preview_number=preview_num,
        )

    def _format_filename(self, version_info: VersionInfo) -> str:
        name = version_info.title.lstrip("v")
        if version_info.is_preview:
            name = re.sub(r'-?preview\d*', '', name, flags=re.IGNORECASE)
            name = name.replace(".", "-")
            name += f"p{version_info.preview_number}"
        else:
            name = name.replace(".", "-")
        return f"{name}.md"

    def _generate_markdown(
        self, version_info: VersionInfo, changelog_content: str
    ) -> str:
        published_date = datetime.now().strftime("%Y-%m-%d")
        if not changelog_content.strip().startswith(
            "## New features, options and improvements"
        ):
            changelog_content = (
                "\n## New features, options and improvements\n\n"
                + changelog_content
            )
        
        title_esc = html.unescape(version_info.title)
        id_esc = html.unescape(version_info.version_id)
        size_esc = html.unescape(version_info.size)

        return f"""---
title: {title_esc}
---

*   Version ID: {id_esc}
*   Size: {size_esc}
*   Published: {published_date}

# Changelog
{changelog_content}"""

    def _save_markdown(self, markdown_content: str, filename: str) -> bool:
        try:
            output_path = self.output_dir / filename
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(markdown_content, encoding="utf-8")
            print(f"Markdown conversion complete. Saved as {output_path}.")
            return True
        except OSError as e:
            print(f"Error saving markdown file {filename}: {e}")
            return False

    def _process_and_save_version(
        self, version_info: VersionInfo, changelog_content: str
    ) -> bool:
        if not version_info:
            return False
        markdown = self._generate_markdown(version_info, changelog_content)
        filename = self._format_filename(version_info)
        return self._save_markdown(markdown, filename)

    def process_html(self, html_content: str, with_preview: bool = True) -> None:
        soup = BeautifulSoup(html_content, "html.parser")
        original_info = self._extract_version_info(soup)
        changelog_content = self._parse_changelog(soup.find("div", class_="changelog"))

        self._process_and_save_version(original_info, changelog_content)

        if with_preview:
            if zip_path := self._find_preview_zip():
                preview_info = self._create_preview_version_info(zip_path)
                if not self._process_and_save_version(
                    preview_info, changelog_content
                ):
                    print("Failed to process preview version.")
            else:
                print("No preview zip file found on desktop.")

def main():
    processor = CSPLogProcessor()
    input_file = processor.desktop_path / INPUT_HTML_FILE
    try:
        html_content = input_file.read_text(encoding="utf-8")
        processor.process_html(html_content)
    except FileNotFoundError:
        print(
            f"Error: '{input_file}' not found. "
            "Please make sure the file exists on your desktop."
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()