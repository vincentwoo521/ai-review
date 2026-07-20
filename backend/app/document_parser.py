import pdfplumber
from typing import List, Dict
import os
import base64
from app.config import settings


class DocumentParser:
    """文档解析器 - 支持 PDF 和图片"""
    
    def __init__(self):
        self.upload_dir = settings.upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)
    
    def parse_pdf(self, file_path: str) -> Dict:
        """
        解析PDF文件
        
        返回格式:
        {
            "content": "完整文本内容",
            "paragraphs": [
                {
                    "index": 0,
                    "text": "段落文本",
                    "page": 1
                },
                ...
            ]
        }
        """
        try:
            with pdfplumber.open(file_path) as pdf:
                all_text = []
                paragraphs = []
                paragraph_index = 0
                
                for page_num, page in enumerate(pdf.pages, start=1):
                    # 提取页面文本
                    page_text = page.extract_text()
                    if page_text:
                        all_text.append(page_text)
                        
                        # 按段落分割（以空行或换行符分割）
                        lines = page_text.split('\n')
                        current_paragraph = []
                        
                        for line in lines:
                            line = line.strip()
                            if line:
                                current_paragraph.append(line)
                            elif current_paragraph:
                                # 遇到空行，保存当前段落
                                paragraph_text = ' '.join(current_paragraph)
                                if len(paragraph_text) > 50:  # 只保存较长的段落
                                    paragraphs.append({
                                        "index": paragraph_index,
                                        "text": paragraph_text,
                                        "page": page_num
                                    })
                                    paragraph_index += 1
                                current_paragraph = []
                        
                        # 保存最后一个段落
                        if current_paragraph:
                            paragraph_text = ' '.join(current_paragraph)
                            if len(paragraph_text) > 50:
                                paragraphs.append({
                                    "index": paragraph_index,
                                    "text": paragraph_text,
                                    "page": page_num
                                })
                                paragraph_index += 1
                
                # 合并所有文本
                full_content = '\n\n'.join(all_text)
                
                return {
                    "content": full_content,
                    "paragraphs": paragraphs
                }
                
        except Exception as e:
            raise Exception(f"PDF解析失败: {str(e)}")
    
    def save_uploaded_file(self, file_content: bytes, file_name: str) -> str:
        """保存上传的文件，返回文件路径"""
        file_path = os.path.join(self.upload_dir, file_name)
        
        # 如果文件已存在，添加时间戳
        if os.path.exists(file_path):
            import time
            base_name, ext = os.path.splitext(file_name)
            file_name = f"{base_name}_{int(time.time())}{ext}"
            file_path = os.path.join(self.upload_dir, file_name)
        
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        return file_path
    
    def parse_image(self, file_path: str) -> Dict:
        """
        解析图片文件，返回 base64 编码用于 AI 视觉模型
        
        返回格式:
        {
            "content": "图片描述将由 AI 生成",
            "image_base64": "base64编码的图片数据",
            "image_type": "图片类型 (jpeg/png等)"
        }
        """
        try:
            # 获取图片类型
            ext = os.path.splitext(file_path)[1].lower()
            image_type_map = {
                '.jpg': 'jpeg',
                '.jpeg': 'jpeg',
                '.png': 'png',
                '.gif': 'gif',
                '.webp': 'webp',
                '.bmp': 'bmp'
            }
            image_type = image_type_map.get(ext, 'jpeg')
            
            # 读取并编码图片
            with open(file_path, 'rb') as f:
                image_data = f.read()
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            return {
                "content": "图片已上传，请使用 AI 视觉模型进行内容识别",
                "image_base64": image_base64,
                "image_type": image_type
            }
            
        except Exception as e:
            raise Exception(f"图片解析失败: {str(e)}")
    
    def parse_file(self, file_path: str, file_type: str = None) -> Dict:
        """
        根据文件类型自动选择解析方法
        
        Args:
            file_path: 文件路径
            file_type: 文件类型 (pdf/image)
        
        Returns:
            解析结果字典
        """
        ext = os.path.splitext(file_path)[1].lower()
        
        # 如果没有指定类型，根据扩展名判断
        if file_type is None:
            if ext == '.pdf':
                file_type = 'pdf'
            elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
                file_type = 'image'
            else:
                raise ValueError(f"不支持的文件类型: {ext}")
        
        if file_type == 'pdf':
            return self.parse_pdf(file_path)
        elif file_type == 'image':
            return self.parse_image(file_path)
        else:
            raise ValueError(f"不支持的文件类型: {file_type}")


# 创建全局解析器实例
document_parser = DocumentParser()